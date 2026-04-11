import crypto from "node:crypto";
import { BookingAcquisitionChannel, BookingType, Car, User } from "@prisma/client";
import { addHours, differenceInCalendarDays } from "date-fns";
import { format, fromZonedTime, toZonedTime } from "date-fns-tz";
import { useEffect, useState } from "react";
import {
  ActionFunctionArgs,
  type LoaderFunctionArgs,
  data,
  redirect,
  useFetcher,
  useLoaderData,
  useSearchParams,
} from "react-router";
import { useAuthenticityToken } from "remix-utils/csrf/react";
import invariant from "tiny-invariant";
import { AIRPORT_PICKUP_BOOKING_TYPE } from "~/components/bookingTypes";
import { BookingsCancelConfirmation } from "~/components/bookings/BookingsCancelConfirmation";
import { BookingsGuestEmailForm } from "~/components/bookings/BookingsGuestEmailForm";
import { BookingsTabsSection } from "~/components/bookings/BookingsTabsSection";
import type { BookingsListBooking } from "~/components/bookings/bookings-index.types";
import logger from "~/lib/logger.server";
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
import { getPublicPartnerBySlug } from "~/services/partners.server";
import { createPaymentIntent } from "~/services/payment.server";
import { validateCSRF } from "~/utils/csrf-action.server";
import { env } from "~/utils/server/env.server";
import { LAGOS_TIMEZONE, getLagosTime } from "~/utils/timezone";

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

  const [timePart, period] = pickupTime.toUpperCase().split(" ");
  const [hourStr] = timePart.split(":");

  let hour = Number.parseInt(hourStr, 10);

  if (period === "PM" && hour !== 12) {
    hour += 12;
  }

  if (period === "AM" && hour === 12) {
    hour = 0;
  }

  const startHour = bookingType === "NIGHT" ? 23 : hour;
  const startDateTime = fromZonedTime(
    `${startDate}T${String(startHour).padStart(2, "0")}:00:00`,
    LAGOS_TIMEZONE,
  );

  let endDateTime: Date;
  if (bookingType === "NIGHT") {
    endDateTime = fromZonedTime(`${endDate}T05:00:00`, LAGOS_TIMEZONE);
  } else if (bookingType === "FULL_DAY") {
    const daySpan = Math.max(1, differenceInCalendarDays(new Date(endDate), new Date(startDate)));
    endDateTime = addHours(startDateTime, 24 * daySpan);
  } else {
    const dayBookingEndAnchor = fromZonedTime(
      `${endDate}T${String(startHour).padStart(2, "0")}:00:00`,
      LAGOS_TIMEZONE,
    );
    endDateTime = addHours(dayBookingEndAnchor, 12);
  }

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
  acquisitionChannel: BookingAcquisitionChannel;
  acquisitionPartnerOwnerId?: string | null;
  acquisitionPartnerSlug?: string | null;
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
    acquisitionChannel: params.acquisitionChannel,
    acquisitionPartnerOwnerId: params.acquisitionPartnerOwnerId,
    acquisitionPartnerSlug: params.acquisitionPartnerSlug,
    user: params.user,
  });

  logger.info(`Created pending booking ${booking.id} with payment intent ${paymentIntentId}`);

  return { checkoutUrl };
}

async function resolveBookingAcquisitionForRequest(
  formData: FormData,
  car: Car,
): Promise<
  | {
      acquisitionChannel: "GLOBAL";
      acquisitionPartnerOwnerId: null;
      acquisitionPartnerSlug: null;
    }
  | {
      acquisitionChannel: "PARTNER";
      acquisitionPartnerOwnerId: string;
      acquisitionPartnerSlug: string;
    }
  | { error: string }
> {
  const rawPartnerSlug = formData.get("partnerSlug");
  if (typeof rawPartnerSlug !== "string") {
    return {
      acquisitionChannel: BookingAcquisitionChannel.GLOBAL,
      acquisitionPartnerOwnerId: null,
      acquisitionPartnerSlug: null,
    };
  }

  if (!rawPartnerSlug) {
    return {
      acquisitionChannel: BookingAcquisitionChannel.GLOBAL,
      acquisitionPartnerOwnerId: null,
      acquisitionPartnerSlug: null,
    };
  }

  const normalizedSlug = rawPartnerSlug.trim().toLowerCase();
  if (!normalizedSlug) {
    return { error: "Invalid partner attribution." };
  }

  const partner = await getPublicPartnerBySlug(normalizedSlug);
  if (!partner) {
    return { error: "Invalid partner attribution." };
  }

  // Server-side guard: partner attribution is only valid for that partner's own fleet.
  if (partner.id !== car.ownerId) {
    return { error: "Partner attribution does not match selected vehicle." };
  }

  return {
    acquisitionChannel: BookingAcquisitionChannel.PARTNER,
    acquisitionPartnerOwnerId: partner.id,
    acquisitionPartnerSlug: partner.publicSlug,
  };
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

  const acquisition = await resolveBookingAcquisitionForRequest(formData, car);
  if ("error" in acquisition) {
    return data({ error: acquisition.error }, { status: 400 });
  }

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
      `Client total amount ${clientTotalAmount} does not match server-calculated amount ${totalCost}. Blocking checkout. useCredits=${useCreditsValue}`,
    );
    return data({ error: "Price mismatch. Please refresh and try again." }, { status: 400 });
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
      acquisitionChannel: acquisition.acquisitionChannel,
      acquisitionPartnerOwnerId: acquisition.acquisitionPartnerOwnerId,
      acquisitionPartnerSlug: acquisition.acquisitionPartnerSlug,
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
    if (guestEmail) {
      const existingUser = await prisma.user.findUnique({
        where: { email: String(guestEmail) },
        select: { id: true },
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
  const [showDropoffByBookingId, setShowDropoffByBookingId] = useState<Record<string, boolean>>({});
  const [activeEditBookingId, setActiveEditBookingId] = useState<string | null>(null);
  const [bookingToCancel, setBookingToCancel] = useState<BookingsListBooking | null>(null);
  const editFetcher = useFetcher<{ success: boolean }>();
  const csrfToken = useAuthenticityToken();

  useEffect(() => {
    if (editFetcher.data?.success) {
      setActiveEditBookingId(null);
    }
  }, [editFetcher.data]);

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      setBookingToCancel(null);
    }
  }, [fetcher.state, fetcher.data]);

  const setShowDropoffForBooking = (bookingId: string, show: boolean) => {
    setShowDropoffByBookingId((previous) => ({ ...previous, [bookingId]: show }));
  };

  const guestEmail = searchParams.get("email");

  if (!Object.keys(bookings ?? {}).length && !guestEmail && !user) {
    return <BookingsGuestEmailForm />;
  }

  return (
    <div className="flex justify-center pt-2 sm:p-4 md:p-6">
      <div className="w-full max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold mb-4">Your Bookings</h2>

        <BookingsTabsSection
          bookings={bookings}
          guestEmail={guestEmail}
          currentStatus={status}
          searchParams={searchParams}
          fetcher={fetcher}
          editFetcher={editFetcher}
          activeEditBookingId={activeEditBookingId}
          setActiveEditBookingId={setActiveEditBookingId}
          showDropoffByBookingId={showDropoffByBookingId}
          setShowDropoffForBooking={setShowDropoffForBooking}
          onRequestCancel={(booking) => setBookingToCancel(booking)}
        />

        {bookingToCancel && (
          <BookingsCancelConfirmation
            booking={bookingToCancel}
            open
            onOpenChange={(open) => {
              if (!open) setBookingToCancel(null);
            }}
            csrfToken={csrfToken}
            fetcher={fetcher}
          />
        )}
      </div>
    </div>
  );
}
