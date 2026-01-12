import { Booking, BookingType, Car, User, VehicleImage } from "@prisma/client";
import { ActionFunctionArgs, type LoaderFunctionArgs, data } from "@remix-run/node";
import {
  Link,
  redirect,
  useFetcher,
  useLoaderData,
  useNavigate,
  useSearchParams,
} from "@remix-run/react";
import { addHours, differenceInCalendarDays } from "date-fns";
import { format, toZonedTime } from "date-fns-tz";
import { ChevronRight } from "lucide-react";
import crypto from "node:crypto";
import { Fragment, useEffect, useState } from "react";
import { useAuthenticityToken } from "remix-utils/csrf/react";
import invariant from "tiny-invariant";
import { AutocompleteAddress } from "~/components/AutocompleteAddress";
import { BookingTimeSelect } from "~/components/booking/BookingTimeSelect";
import { AIRPORT_PICKUP_BOOKING_TYPE } from "~/components/bookingTypes";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import logger from "~/lib/logger.server";
import { formatCurrency, getLegExtendableDuration, isBookingEditable } from "~/lib/utils";
import { getSessionUser } from "~/modules/auth/auth.server";
import { prisma } from "~/modules/db/db.server";
import { availableCarsForSpecificRequest } from "~/services/availability-engine.server";
import {
  calculateBookingCost,
  cancelBooking,
  createPendingBooking,
  getBookingsByStatus,
} from "~/services/bookings.server";
import { validateFlight } from "~/services/flight-validation.server";
import { calculateAirportTripDuration } from "~/services/google-maps.server";
import { createPaymentIntent } from "~/services/payment.server";
import { validateCSRF } from "~/utils/csrf-action.server";
import { env } from "~/utils/server/env.server";
import { LAGOS_TIMEZONE, getLagosTime } from "~/utils/timezone";

type BookingWithRelations = Booking & {
  car: Car & { owner: User; images: VehicleImage[] };
  chauffeur?: User | null;
};

type BookingUser = User | { email: string; name: string; phoneNumber: string };

interface BookingTimeResult {
  startDateTime: Date;
  endDateTime: Date;
  estimatedDuration?: number;
  flightArrivalTime?: Date;
}

interface AirportPickupParams {
  flightNumber: string;
  startDate: string;
  pickupAddress: string;
  dropOffAddress: string;
  sameLocation: FormDataEntryValue | null;
}

async function calculateAirportPickupTimes(
  params: AirportPickupParams,
): Promise<{ error: string } | BookingTimeResult> {
  const { flightNumber, startDate, pickupAddress, dropOffAddress, sameLocation } = params;

  const flightResult = await validateFlight(flightNumber, startDate);

  if (flightResult.type !== "success") {
    let errorMessage: string;

    if (flightResult.type === "alreadyLanded") {
      errorMessage = `Flight ${flightNumber} has already landed. Please select a future flight.`;
    } else if (flightResult.type === "notFound") {
      errorMessage = `Flight ${flightNumber} not found for ${startDate}. Please verify the flight number and date.`;
    } else {
      errorMessage = flightResult.message || "Failed to validate flight";
    }

    return { error: errorMessage };
  }

  const flight = flightResult.flight;
  const rawArrival = flight.actualArrival || flight.estimatedArrival || flight.scheduledArrival;

  if (!rawArrival) {
    logger.error(`[AIRPORT_PICKUP] Flight ${flightNumber} arrival time not available`, { flight });
    return { error: "Flight arrival time not available" };
  }

  const flightArrivalTime = new Date(rawArrival);

  logger.info("[AIRPORT_PICKUP] Flight result", { flightResult });
  logger.info(
    `[AIRPORT_PICKUP] Flight ${flightNumber} arrival time: ${flightArrivalTime.toISOString()}`,
  );

  const returnLocation = sameLocation === "true" ? pickupAddress : dropOffAddress;
  const tripDuration = await calculateAirportTripDuration(returnLocation, flightArrivalTime);

  // Add 20% buffer to drive time for real-world conditions
  const bufferedDriveMinutes = Math.ceil(tripDuration.durationInMinutes * 1.2);

  // Pickup time = Flight arrival + 40 min buffer
  const pickupDateTime = new Date(flightArrivalTime.getTime() + 40 * 60 * 1000);
  const startDateTime = new Date(pickupDateTime);

  // Drop-off time = Pickup time + buffered drive duration
  const dropOffDateTime = new Date(pickupDateTime.getTime() + bufferedDriveMinutes * 60 * 1000);
  const endDateTime = new Date(dropOffDateTime);

  logger.info(
    `[AIRPORT_PICKUP] Flight ${flightNumber} arrives at ${format(toZonedTime(flightArrivalTime, LAGOS_TIMEZONE), "PPPp")}`,
  );
  logger.info(
    `[AIRPORT_PICKUP] Pickup at ${format(toZonedTime(pickupDateTime, LAGOS_TIMEZONE), "PPPp")} (40 min after arrival)`,
  );
  logger.info(
    `[AIRPORT_PICKUP] Google Maps estimated drive: ${tripDuration.durationText}, Buffered: ${bufferedDriveMinutes} mins (+20%)`,
  );
  logger.info(
    `[AIRPORT_PICKUP] Drop-off at ${format(toZonedTime(dropOffDateTime, LAGOS_TIMEZONE), "PPPp")} (${bufferedDriveMinutes} mins drive with buffer)`,
  );

  return {
    startDateTime,
    endDateTime,
    estimatedDuration: bufferedDriveMinutes,
    flightArrivalTime,
  };
}

function calculateRegularBookingTimes(
  pickupTime: string,
  bookingType: string,
  startDate: string,
  endDate: string,
): { error: string } | BookingTimeResult {
  if (!pickupTime || !/^(1[0-2]|[1-9])(:00)?\s?(AM|PM)$/i.test(pickupTime)) {
    return { error: "Invalid pickup time format" };
  }

  const startDateTime = toZonedTime(new Date(startDate), LAGOS_TIMEZONE);
  const endDateTime = toZonedTime(new Date(endDate), LAGOS_TIMEZONE);

  const [timePart, period] = pickupTime.toUpperCase().split(" ");
  const [hourStr] = timePart.split(":");

  let hour = Number.parseInt(hourStr, 10);

  if (period === "PM" && hour !== 12) {
    hour += 12;
  }

  if (period === "AM" && hour === 12) {
    hour = 0;
  }

  startDateTime.setHours(bookingType === "NIGHT" ? 23 : hour);
  startDateTime.setMinutes(0);
  startDateTime.setSeconds(0);
  startDateTime.setMilliseconds(0);

  if (bookingType === "NIGHT") {
    endDateTime.setHours(5);
  } else if (bookingType === "FULL_DAY") {
    const daySpan = Math.max(1, differenceInCalendarDays(new Date(endDate), new Date(startDate)));
    const adjusted = addHours(startDateTime, 24 * daySpan);
    endDateTime.setTime(adjusted.getTime());
  } else {
    endDateTime.setHours(startDateTime.getHours() + 12);
    endDateTime.setMinutes(startDateTime.getMinutes());
  }
  endDateTime.setSeconds(0);
  endDateTime.setMilliseconds(0);

  return { startDateTime, endDateTime };
}

function validateBookingTime(
  bookingType: string,
  startDateTime: Date,
  flightArrivalTime: Date | undefined,
  now: Date,
): { error: string } | null {
  if (bookingType === AIRPORT_PICKUP_BOOKING_TYPE) {
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
    logger.info({ startDateTime, now, flightArrivalTime, oneHourFromNow });
    if (startDateTime < oneHourFromNow) {
      return { error: "Airport pickup bookings require at least 1 hour advance notice" };
    }
  } else {
    if (startDateTime < now) {
      return { error: "Booking time cannot be in the past" };
    }

    if (
      bookingType === "DAY" &&
      startDateTime.toDateString() === now.toDateString() &&
      now.getHours() >= 11
    ) {
      return { error: "Same-day bookings cannot be made at or after 11am" };
    }
  }
  return null;
}

async function checkCarAvailability(
  carId: string,
  bookingType: string,
  startDateTime: Date,
  endDateTime: Date,
): Promise<{ car: Car } | { error: string; status: number }> {
  const car = await prisma.car.findUnique({ where: { id: carId } });
  if (!car) {
    return { error: "Car not found", status: 404 };
  }

  const existingBookings = await prisma.booking.findMany({
    where: {
      carId,
      paymentStatus: "PAID",
      status: { in: ["CONFIRMED", "ACTIVE"] },
    },
    select: {
      id: true,
      carId: true,
      startDate: true,
      endDate: true,
      status: true,
      type: true,
      paymentStatus: true,
    },
  });

  const availableCarIds = availableCarsForSpecificRequest([car], existingBookings, {
    bookingType: bookingType as BookingType,
    from: startDateTime,
    to: endDateTime,
  });

  if (availableCarIds.length === 0) {
    return {
      error:
        "This car is no longer available for the selected dates and times. Please choose different dates or another car.",
      status: 409,
    };
  }

  return { car };
}

async function handleDeleteBooking(formData: FormData) {
  const bookingId = String(formData.get("bookingId"));
  const reason = String(formData.get("reason"));

  invariant(bookingId, "Booking ID is required");
  invariant(reason, "Cancellation reason is required");

  try {
    await cancelBooking(bookingId, reason);
    return { success: true };
  } catch (error) {
    logger.error(`Failed to cancel booking: ${error}`);
    return data({ error: "Failed to cancel booking" }, { status: 500 });
  }
}

interface BookingFormData {
  pickupAddress: string;
  dropOffAddress: string;
  sameLocation: FormDataEntryValue | null;
  pickupTime: string;
  carId: string;
  bookingType: string;
  includeSecurityDetail: boolean;
  requiresFullTank: boolean;
  flightNumber: string | undefined;
  clientTotalAmount: string;
  useCreditsValue: number;
}

function extractBookingFormData(formData: FormData): BookingFormData {
  const getText = (key: string): string => {
    const value = formData.get(key);
    return typeof value === "string" ? value : "";
  };
  return {
    pickupAddress: getText("pickupAddress"),
    sameLocation: formData.get("sameLocation"),
    pickupTime: getText("pickupTime"),
    dropOffAddress: getText("dropOffAddress"),
    carId: getText("carId"),
    bookingType: getText("bookingType"),
    includeSecurityDetail: formData.get("includeSecurityDetail") === "true",
    requiresFullTank: formData.get("requiresFullTank") === "true",
    flightNumber: formData.get("flightNumber")?.toString() || undefined,
    clientTotalAmount: formData.get("totalAmount")?.toString() || "",
    useCreditsValue: Number(formData.get("useCredits")) || 0,
  };
}

async function getBookingTimes(
  bookingData: BookingFormData,
  startDate: string,
  endDate: string,
): Promise<{ error: string } | BookingTimeResult> {
  const { bookingType, flightNumber, pickupAddress, dropOffAddress, sameLocation, pickupTime } =
    bookingData;

  if (bookingType !== AIRPORT_PICKUP_BOOKING_TYPE) {
    return calculateRegularBookingTimes(pickupTime, bookingType, startDate, endDate);
  }

  if (!flightNumber) {
    return { error: "Flight number is required for airport pickup bookings" };
  }

  return calculateAirportPickupTimes({
    flightNumber,
    startDate,
    pickupAddress,
    dropOffAddress,
    sameLocation,
  });
}

async function createBookingWithPayment(params: {
  totalCost: number;
  user: BookingUser;
  carId: string;
  startDateTime: Date;
  endDateTime: Date;
  bookingType: string;
  car: Car;
  pickupLocation: string;
  returnLocation: string;
  includeSecurityDetail: boolean;
  requiresFullTank: boolean;
  useCreditsValue: number;
  flightNumber: string | undefined;
  estimatedDuration: number | undefined;
  callbackUrl: string;
}) {
  const idempotencyKey = crypto.randomUUID();

  const { paymentIntentId, checkoutUrl } = await createPaymentIntent({
    amount: params.totalCost,
    customer: {
      email: params.user.email,
      name: params.user.name || "Customer",
      phone_number: params.user.phoneNumber || "",
    },
    metadata: {
      transactionType: "booking_creation",
      carId: params.carId,
      startDate: params.startDateTime.toISOString(),
      endDate: params.endDateTime.toISOString(),
      bookingType: params.bookingType,
    },
    idempotencyKey,
    callbackUrl: params.callbackUrl,
  });

  const booking = await createPendingBooking({
    startDate: params.startDateTime,
    endDate: params.endDateTime,
    car: params.car,
    pickupLocation: params.pickupLocation,
    returnLocation: params.returnLocation,
    paymentIntent: paymentIntentId,
    type: params.bookingType as BookingType,
    includeSecurityDetail: params.includeSecurityDetail,
    requiresFullTank: params.requiresFullTank,
    useCredits: params.useCreditsValue,
    flightNumber: params.flightNumber,
    estimatedDuration: params.estimatedDuration,
    user: params.user,
  });

  logger.info(`Created pending booking ${booking.id} with payment intent ${paymentIntentId}`);

  return { checkoutUrl };
}

async function handleCreateBooking(request: Request, formData: FormData, user: BookingUser) {
  const url = new URL(request.url);
  const startDate = url.searchParams.get("from");
  const endDate = url.searchParams.get("to");

  invariant(startDate, "From Date is required");
  invariant(endDate, "To Date is required");

  if (new Date(endDate) < new Date(startDate)) {
    return data({ error: "End date cannot be before start date" }, { status: 400 });
  }

  logger.info(`Booking request received: ${startDate} to ${endDate}`);

  const bookingData = extractBookingFormData(formData);
  const {
    carId,
    bookingType,
    includeSecurityDetail,
    requiresFullTank,
    useCreditsValue,
    clientTotalAmount,
  } = bookingData;

  const timeResult = await getBookingTimes(bookingData, startDate, endDate);
  if ("error" in timeResult) {
    return data({ error: timeResult.error }, { status: 400 });
  }

  const { startDateTime, endDateTime, estimatedDuration, flightArrivalTime } = timeResult;

  const timeValidationError = validateBookingTime(
    bookingType,
    startDateTime,
    flightArrivalTime,
    getLagosTime(),
  );
  if (timeValidationError) {
    return data({ error: timeValidationError.error }, { status: 400 });
  }

  const pickupLocation = bookingData.pickupAddress;
  const returnLocation =
    bookingData.sameLocation === "true" ? bookingData.pickupAddress : bookingData.dropOffAddress;

  const availabilityResult = await checkCarAvailability(
    carId,
    bookingType,
    startDateTime,
    endDateTime,
  );
  if ("error" in availabilityResult) {
    return data({ error: availabilityResult.error }, { status: availabilityResult.status });
  }
  const { car } = availabilityResult;

  const userId = "id" in user ? user.id : "N/A";
  logger.info(
    `Booking calculation inputs: useCredits=${useCreditsValue}, user.id=${userId}, includeSecurityDetail=${includeSecurityDetail}, requiresFullTank=${requiresFullTank}`,
  );
  logger.info(
    `Car rates: dayRate=${car.dayRate}, nightRate=${car.nightRate}, fullDayRate=${car.fullDayRate}, fuelUpgradeRate=${car.fuelUpgradeRate}`,
  );
  logger.info(
    `Booking dates: ${startDateTime.toISOString()} to ${endDateTime.toISOString()}, type=${bookingType}`,
  );

  const calculationResult = await calculateBookingCost({
    car,
    startDate: startDateTime,
    endDate: endDateTime,
    type: bookingType as BookingType,
    includeSecurityDetail,
    requiresFullTank,
    useCredits: useCreditsValue,
    user,
  });

  const { totalAmount: totalCost } = calculationResult;

  logger.info(
    `Server calculation breakdown: netTotal=${calculationResult.netTotal}, platformFee=${calculationResult.platformCustomerServiceFeeAmount}, subtotalBeforeDiscounts=${calculationResult.subtotalBeforeDiscounts}, referralDiscount=${calculationResult.referralDiscountAmount}, creditsUsed=${calculationResult.bookingCreditsUsed}, subtotalAfterDiscounts=${calculationResult.subtotalAfterDiscounts}, VAT=${calculationResult.vatAmount}, finalTotal=${totalCost}`,
  );

  if (clientTotalAmount && Number(clientTotalAmount) !== totalCost.toNumber()) {
    logger.error(
      `Client total amount ${clientTotalAmount} does not match server-calculated amount ${totalCost}. Trusting server amount. useCredits=${useCreditsValue}`,
    );
    return data({ error: "Price mismatch. Please try again." }, { status: 400 });
  }

  try {
    const { checkoutUrl } = await createBookingWithPayment({
      totalCost: totalCost.toNumber(),
      user,
      carId,
      startDateTime,
      endDateTime,
      bookingType,
      car,
      pickupLocation,
      returnLocation,
      includeSecurityDetail,
      requiresFullTank,
      useCreditsValue,
      flightNumber: bookingData.flightNumber,
      estimatedDuration,
      callbackUrl: `${env.DOMAIN}/bookings/payment-status?transactionType=booking_creation`,
    });

    return redirect(checkoutUrl);
  } catch (error) {
    logger.error(
      `Error creating booking or payment intent: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
    return data(
      {
        errors: {
          general: error instanceof Error ? error.message : "An unexpected error occurred",
        },
      },
      { status: 500 },
    );
  }
}

export async function action({ request }: ActionFunctionArgs) {
  await validateCSRF(request);

  let user: BookingUser | null = await getSessionUser(request);
  const formData = await request.formData();

  const guestEmail = formData.get("email") || "";
  const guestName = formData.get("name") || "";
  const guestPhoneNumber = formData.get("phoneNumber") || "";

  if (guestEmail) {
    user = {
      email: String(guestEmail),
      name: String(guestName),
      phoneNumber: String(guestPhoneNumber),
    };
  }

  if (request.method === "DELETE") {
    return handleDeleteBooking(formData);
  }

  if (request.method === "POST") {
    // Check if guest email exists as a user
    if (guestEmail) {
      const existingUser = await prisma.user.findUnique({
        where: { email: String(guestEmail) },
      });

      if (existingUser) {
        return data(
          { error: "This email is registered to an existing user. Please login to continue." },
          { status: 400 },
        );
      }
    }

    if (!user) {
      return data({ error: "User not found" }, { status: 400 });
    }

    return handleCreateBooking(request, formData, user);
  }

  if (request.method === "GET" && user?.email) {
    const bookings = await getBookingsByStatus(user.email);
    return { bookings };
  }

  return data({ error: "Invalid request method" }, { status: 405 });
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const guestEmail = url.searchParams.get("email");

  let user: User | null | { email: string; name?: string; phoneNumber?: string } = null;

  if (guestEmail) {
    user = { email: guestEmail };
  } else {
    user = await getSessionUser(request);
  }

  const email = guestEmail || user?.email;

  if (!email) {
    logger.info("No email found");
    return { bookings: null, user };
  }

  const bookings = await getBookingsByStatus(email, Boolean(guestEmail));

  return { bookings, user };
}

export default function BookingsPage() {
  const { bookings, user } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [searchParams] = useSearchParams();
  const status = searchParams.get("status")?.toUpperCase() ?? "ACTIVE";
  const navigate = useNavigate();
  const statuses = ["ACTIVE", "CONFIRMED", "COMPLETED", "CANCELLED"] as const;
  const [showDropoffFields, setShowDropoffFields] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState<BookingWithRelations | null>(null);
  const editFetcher = useFetcher<{ success: boolean }>();
  const csrfToken = useAuthenticityToken();
  const LAGOS_TZ = "Africa/Lagos";

  useEffect(() => {
    if (editFetcher.data?.success) {
      setIsDialogOpen(false);
    }
  }, [editFetcher.data]);

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      setBookingToCancel(null);
    }
  }, [fetcher.state, fetcher.data]);

  const guestEmail = searchParams.get("email");

  if (!Object.keys(bookings ?? {}).length && !guestEmail && !user) {
    return (
      <div className="max-w-md mx-auto mt-8">
        <h2 className="text-2xl font-bold mb-4">Find Your Bookings</h2>
        <form method="get" action="/bookings?status=confirmed" className="space-y-4">
          <div>
            <Label htmlFor="guestEmail">Enter your email address</Label>
            <Input id="email" name="email" type="email" placeholder="your@email.com" required />
          </div>
          <Button type="submit" className="w-full">
            Find Bookings
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex justify-center pt-2 sm:p-4 md:p-6">
      <div className="w-full max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold mb-4">Your Bookings</h2>

        <Tabs defaultValue={status} className="w-full">
          <TabsList className="flex overflow-x-auto bg-white justify-start space-x-4 p-0">
            {statuses.map((status) => (
              <TabsTrigger
                className="whitespace-nowrap gap-1 antialiased rounded border data-[state=active]:border-primary data-[state=active]:border-1"
                key={status}
                value={status}
                onClick={() => {
                  const newSearchParams = new URLSearchParams(searchParams);
                  newSearchParams.set("status", status.toLowerCase());
                  navigate(`/bookings?${newSearchParams.toString()}`);
                }}
              >
                {status.charAt(0) + status.slice(1).toLowerCase()}
                <span>({bookings?.[status]?.length || 0})</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {statuses.map((status) => (
            <TabsContent
              className="shadow-md border border-gray-200 transition-shadow rounded"
              key={status}
              value={status}
            >
              <div className="flex flex-col">
                {bookings?.[status]?.map((booking) => {
                  const isThisBookingBeingCancelled =
                    fetcher.state !== "idle" && fetcher.formData?.get("bookingId") === booking.id;
                  const emailQueryParam = guestEmail ? `?email=${guestEmail}` : "";
                  const linkClassName = isThisBookingBeingCancelled
                    ? "flex items-center gap-4 w-full pointer-events-none"
                    : "flex items-center gap-4 w-full";
                  return (
                    <Fragment key={booking.id}>
                      <div
                        key={booking.id}
                        className="sm:flex-row flex-col flex justify-between px-2 py-4 border-b last:border-0"
                      >
                        <Link
                          to={`/bookings/${booking.id}${emailQueryParam}`}
                          className={linkClassName}
                        >
                          <img
                            src={booking.car.images[0].url}
                            alt={`${booking.car.make} ${booking.car.model}`}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-pretty text-sm font-semibold">
                                {booking.car.make} {booking.car.model} ({booking.car.year}) -{" "}
                                <span className="text-gray-500 italic">
                                  {booking.bookingReference}
                                </span>
                              </h3>
                              {booking.status === "COMPLETED" && (
                                <Badge
                                  variant="outline"
                                  className={`text-xs rounded-sm ${
                                    booking.review
                                      ? "bg-green-50 text-green-700 border-green-200"
                                      : "bg-amber-50 text-amber-700 border-amber-200"
                                  }`}
                                >
                                  {booking.review ? "Reviewed" : "Review Pending"}
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-pretty text-gray-600 space-y-1">
                              <p className="sm:block hidden">
                                {format(toZonedTime(new Date(booking.startDate), LAGOS_TZ), "PPPp")}{" "}
                                to{" "}
                                {format(toZonedTime(new Date(booking.endDate), LAGOS_TZ), "PPPp")}
                              </p>

                              <p className="sm:hidden block">
                                {format(toZonedTime(new Date(booking.startDate), LAGOS_TZ), "PPPp")}
                              </p>
                              <p className="sm:hidden block">
                                {format(toZonedTime(new Date(booking.endDate), LAGOS_TZ), "PPPp")}
                              </p>

                              <p className="text-pretty text-sm font-semibold">
                                {formatCurrency(Number(booking.totalAmount))}
                                {/* <span className="inline-flex items-center px-1">.</span>
                              <span className=" text-gray-500">{formatDate(booking.createdAt)}</span> */}
                              </p>
                            </div>
                          </div>
                        </Link>

                        <div className="flex sm:flex-row flex-col gap-2 sm:mt-0 mt-2 items-center justify-center">
                          {getLegExtendableDuration(booking) > 0 && (
                            <Link
                              to={`/bookings/${booking.id}/extend${emailQueryParam}`}
                              className="bg-green-700 hover:bg-green-800 p-2 border text-white rounded text-center sm:w-auto w-full transition duration-300 ease-in-out"
                            >
                              Extend
                            </Link>
                          )}

                          {booking.status === "CONFIRMED" &&
                            isBookingEditable(new Date(booking.startDate)) && (
                              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                                <DialogTrigger asChild>
                                  <Button
                                    variant="outline"
                                    className="sm:w-auto w-full bg-gray-100"
                                    disabled={isThisBookingBeingCancelled}
                                  >
                                    Modify Booking
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-[425px]">
                                  <DialogHeader>
                                    <DialogTitle>
                                      {booking.car.make} {booking.car.model} {booking.car.year}
                                    </DialogTitle>
                                    <DialogDescription>
                                      {booking.type === "DAY"
                                        ? "Edit the pickup time, pickup address, and drop-off address"
                                        : "Edit the pickup time and pickup address"}
                                    </DialogDescription>
                                  </DialogHeader>
                                  <editFetcher.Form
                                    method="PATCH"
                                    action={`/bookings/${booking.id}`}
                                    className="space-y-4"
                                    key={booking.id}
                                  >
                                    <input type="hidden" name="bookingId" value={booking.id} />
                                    <div className="grid gap-4 py-4">
                                      {booking.type === "DAY" && (
                                        <div className="space-y-2">
                                          <label
                                            htmlFor="pickupTime"
                                            className="text-sm font-medium"
                                          >
                                            Pickup Time
                                          </label>
                                          <BookingTimeSelect
                                            date={new Date(booking.startDate)}
                                            defaultValue={new Date(
                                              booking.startDate,
                                            ).toLocaleTimeString("en-US", {
                                              hour: "numeric",
                                              minute: "numeric",
                                              hour12: true,
                                            })}
                                          />
                                        </div>
                                      )}

                                      <div className="space-y-2">
                                        <label className="text-sm font-medium">
                                          Pickup Address
                                        </label>
                                        <AutocompleteAddress
                                          id="pickupAddress"
                                          inputProps={{
                                            name: "pickupAddress",
                                            placeholder: "Enter pickup address",
                                          }}
                                          onSelect={() => {}}
                                        />
                                      </div>

                                      <div className="space-y-1">
                                        <div className="flex items-center space-x-2">
                                          <Checkbox
                                            id="sameLocation"
                                            name="sameLocation"
                                            defaultChecked={
                                              booking.pickupLocation === booking.returnLocation
                                            }
                                            onCheckedChange={(checked) =>
                                              setShowDropoffFields(!checked)
                                            }
                                          />
                                          <Label htmlFor="sameLocation">
                                            Drop-off location same as pickup
                                          </Label>
                                        </div>
                                      </div>

                                      {showDropoffFields && (
                                        <div className="space-y-2">
                                          <label className="text-sm font-medium">
                                            Drop-off Address
                                          </label>
                                          <AutocompleteAddress
                                            id="dropOffAddress"
                                            inputProps={{
                                              name: "dropOffAddress",
                                              placeholder: "Enter drop-off address",
                                            }}
                                            onSelect={() => {}}
                                          />
                                        </div>
                                      )}
                                    </div>

                                    <div className="flex justify-end gap-3">
                                      <Button
                                        variant="outline"
                                        type="button"
                                        onClick={() => setIsDialogOpen(false)}
                                      >
                                        Cancel
                                      </Button>
                                      <Button type="submit">Save Changes</Button>
                                    </div>
                                  </editFetcher.Form>
                                </DialogContent>
                              </Dialog>
                            )}

                          {["PENDING", "CONFIRMED"].includes(booking.status) &&
                            isBookingEditable(new Date(booking.startDate)) && (
                              <Button
                                variant="destructive"
                                className="sm:w-auto w-full"
                                onClick={() => setBookingToCancel(booking)}
                                disabled={isThisBookingBeingCancelled}
                              >
                                {isThisBookingBeingCancelled ? "Cancelling..." : "Cancel Booking"}
                              </Button>
                            )}

                          <ChevronRight className="w-4 h-4 text-gray-500 sm:block hidden" />
                        </div>
                      </div>
                    </Fragment>
                  );
                })}
                {(!bookings?.[status] || bookings?.[status]?.length === 0) && (
                  <div className="text-center py-8 text-gray-500">
                    No {status.toLowerCase()} bookings
                  </div>
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>

        {bookingToCancel && (
          <Dialog
            open={!!bookingToCancel}
            onOpenChange={(isOpen) => {
              if (!isOpen) {
                setBookingToCancel(null);
              }
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="text-center font-semibold">
                  Are you sure you want to cancel?
                </DialogTitle>
                <DialogDescription className="text-center pt-2 text-sm">
                  This action cannot be undone. This will permanently cancel your booking for the{" "}
                  <span className="font-medium">
                    {bookingToCancel.car.make} {bookingToCancel.car.model}
                  </span>
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex flex-row justify-end gap-2 sm:justify-end">
                <Button variant="outline" type="button" onClick={() => setBookingToCancel(null)}>
                  No
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (!bookingToCancel) return;
                    fetcher.submit(
                      {
                        bookingId: bookingToCancel.id,
                        reason: "User requested cancellation",
                        csrf: csrfToken,
                      },
                      {
                        method: "DELETE",
                        action: `/bookings/${bookingToCancel.id}`,
                      },
                    );
                    setBookingToCancel(null);
                  }}
                >
                  Yes, Cancel Booking
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}
