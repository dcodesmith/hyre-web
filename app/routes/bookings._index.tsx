import { Booking, BookingStatus, BookingType, Car, User, VehicleImage } from "@prisma/client";
import { ActionFunctionArgs, type LoaderFunctionArgs, data } from "@remix-run/node";
import {
  Link,
  redirect,
  useFetcher,
  useLoaderData,
  useNavigate,
  useSearchParams,
} from "@remix-run/react";
import { format, differenceInCalendarDays, addHours } from "date-fns";
import { ChevronRight } from "lucide-react";
import crypto from "node:crypto";
import { Fragment, useEffect, useState } from "react";
import invariant from "tiny-invariant";
import { AutocompleteAddress } from "~/components/AutocompleteAddress";
import { validateCSRF } from "~/utils/csrf-action.server";
import { BookingTimeSelect } from "~/components/booking/BookingTimeSelect";
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
import {
  cancelBooking,
  createPendingBooking,
  getBookingsByStatus,
  calculateBookingCost,
} from "~/services/bookings.server";
import { createPaymentIntent } from "~/services/payment.server";
import { env } from "~/utils/server/env.server";
import { useAuthenticityToken } from "remix-utils/csrf/react";

type BookingWithRelations = Booking & {
  car: Car & { owner: User; images: VehicleImage[] };
  chauffeur?: User | null;
};

export async function action({ request }: ActionFunctionArgs) {
  await validateCSRF(request);

  let user: User | null | { email: string; name: string; phoneNumber: string } = null;

  user = await getSessionUser(request);
  const formData = await request.formData();

  const guestEmail = formData.get("email") || "";
  const guestName = formData.get("name") || "";
  const guestPhoneNumber = formData.get("phoneNumber") || "";
  // Get either guest user or authenticated user

  if (guestEmail) {
    user = {
      email: String(guestEmail),
      name: String(guestName),
      phoneNumber: String(guestPhoneNumber),
    };
  }

  if (request.method === "DELETE") {
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

  if (request.method === "POST") {
    const url = new URL(request.url);
    const startDate = url.searchParams.get("from");
    const endDate = url.searchParams.get("to");

    invariant(startDate, "From Date is required");
    invariant(endDate, "To Date is required");

    const now = new Date();

    if (new Date(endDate) < new Date(startDate)) {
      return data({ error: "End date cannot be before start date" }, { status: 400 });
    }

    logger.info(`Booking request received: ${startDate} to ${endDate}`);

    const pickupAddress = String(formData.get("pickupAddress"));
    const sameLocation = formData.get("sameLocation");
    const pickupTime = String(formData.get("pickupTime"));
    const dropOffAddress = String(formData.get("dropOffAddress"));
    const carId = String(formData.get("carId"));
    const bookingType = String(formData.get("bookingType"));
    const includeSecurityDetail = formData.get("includeSecurityDetail") === "true";
    const requiresFullTank = formData.get("requiresFullTank") === "true";

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

    // Parse the time from pickupTime (e.g. "8:00 AM") and set it on startDate
    // const [hours, period] = pickupTime.split(" ");

    if (!pickupTime || !/^(1[0-2]|[1-9])(:00)?\s?(AM|PM)$/i.test(pickupTime)) {
      return new Response("Invalid pickup time format", { status: 400 });
    }

    const [timePart, period] = pickupTime.toUpperCase().split(" ");
    const [hourStr] = timePart.split(":");

    const startDateTime = new Date(startDate);

    // Convert 12-hour format to 24-hour
    let hour = Number.parseInt(hourStr, 10);

    if (period === "PM" && hour !== 12) {
      hour += 12;
    }

    if (period === "AM" && hour === 12) {
      hour = 0; // Fix 12 AM = midnight
    }

    startDateTime.setHours(bookingType === "NIGHT" ? 23 : hour);
    startDateTime.setMinutes(0);
    startDateTime.setSeconds(0);
    startDateTime.setMilliseconds(0);

    // Set end date time based on booking type
    const endDateTime = new Date(endDate);

    if (bookingType === "NIGHT") {
      // For night bookings, end time should be 5am on the end date
      endDateTime.setHours(5);
    } else if (bookingType === "FULL_DAY") {
      // For FULL_DAY bookings, enforce strict 24h blocks from the pickup time (DST-safe)
      const daySpan = Math.max(1, differenceInCalendarDays(new Date(endDate), new Date(startDate)));
      const adjusted = addHours(startDateTime, 24 * daySpan);
      endDateTime.setTime(adjusted.getTime());
    } else {
      // For day bookings, end time should be 12 hours after start time
      endDateTime.setHours(startDateTime.getHours() + 12);
      endDateTime.setMinutes(startDateTime.getMinutes());
    }
    endDateTime.setSeconds(0);
    endDateTime.setMilliseconds(0);

    if (
      startDateTime < now ||
      (bookingType === "DAY" &&
        startDateTime.toDateString() === now.toDateString() &&
        now.getHours() >= 12)
    ) {
      return data(
        { error: "Day bookings cannot be made at or after 12pm of the current day" },
        { status: 400 },
      );
    }

    const pickupLocation = pickupAddress;
    const returnLocation = sameLocation === "true" ? pickupAddress : dropOffAddress;

    if (!user) {
      return data({ error: "User not found" }, { status: 400 });
    }

    // Calculate the total cost for creating payment intent
    const car = await prisma.car.findUnique({ where: { id: carId } });
    if (!car) {
      return data({ error: "Car not found" }, { status: 404 });
    }

    const clientTotalAmount = formData.get("totalAmount");

    const { totalAmount: totalCost } = await calculateBookingCost({
      car,
      startDate: startDateTime,
      endDate: endDateTime,
      type: bookingType as BookingType,
      includeSecurityDetail,
      requiresFullTank,
    });

    if (clientTotalAmount && Number(clientTotalAmount) !== totalCost.toNumber()) {
      logger.error(
        `Client total amount ${clientTotalAmount} does not match server-calculated amount ${totalCost}. Trusting server amount.`,
      );
      // Optional: uncomment the line below to block the transaction if prices mismatch
      return data({ error: "Price mismatch. Please try again." }, { status: 400 });
    }

    try {
      // Generate idempotency key for this booking attempt
      const idempotencyKey = crypto.randomUUID();

      // Create payment intent
      const { paymentIntentId, checkoutUrl } = await createPaymentIntent({
        amount: totalCost.toNumber(),
        customer: {
          email: user.email,
          name: user.name || "Customer",
          phone_number: user.phoneNumber || "",
        },
        metadata: {
          transactionType: "booking_creation",
          carId,
          startDate: startDateTime.toISOString(),
          endDate: endDateTime.toISOString(),
          bookingType,
        },
        idempotencyKey,
        callbackUrl: `${env.DOMAIN || url.origin}/bookings/payment-status?transactionType=booking_creation`,
      });

      const booking = await createPendingBooking({
        startDate: startDateTime,
        endDate: endDateTime,
        car,
        user,
        pickupLocation,
        returnLocation,
        paymentIntent: paymentIntentId,
        type: bookingType as BookingType,
        includeSecurityDetail,
        requiresFullTank,
      });

      logger.info(`Created pending booking ${booking.id} with payment intent ${paymentIntentId}`);

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

  if (request.method === "GET" && user?.email) {
    const bookings = await getBookingsByStatus(user?.email);
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
  const status = searchParams.get("status")?.toLocaleUpperCase() ?? "ACTIVE";
  const navigate = useNavigate();
  const statuses = ["ACTIVE", "CONFIRMED", "COMPLETED", "CANCELLED"] as const;
  const [showDropoffFields, setShowDropoffFields] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState<BookingWithRelations | null>(null);
  const editFetcher = useFetcher<{ success: boolean }>();
  const csrfToken = useAuthenticityToken();

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

  if (!Object.keys(bookings).length && !guestEmail && !user) {
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
    <div className="flex justify-center">
      <div className="w-full max-w-4xl">
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
                  return (
                    <Fragment key={booking.id}>
                      <div
                        key={booking.id}
                        className="sm:flex-row flex-col flex justify-between px-2 py-4 border-b last:border-0"
                      >
                        <Link
                          to={`/bookings/${booking.id}${guestEmail ? `?email=${guestEmail}` : ""}`}
                          className={`flex items-center gap-4 w-full ${isThisBookingBeingCancelled ? "pointer-events-none" : ""}`}
                        >
                          <img
                            src={booking.car.images[0].url}
                            alt={`${booking.car.make} ${booking.car.model}`}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                          <div className="space-y-1">
                            <h3 className="text-pretty text-sm font-semibold">
                              {booking.car.make} {booking.car.model} ({booking.car.year}) -{" "}
                              <span className="text-gray-500 italic">
                                {booking.bookingReference}
                              </span>
                            </h3>
                            <div className="text-sm text-pretty text-gray-600 space-y-1">
                              <p className="sm:block hidden">
                                {format(booking.startDate, "PPPp")} to{" "}
                                {format(booking.endDate, "PPPp")}
                              </p>

                              <p className="sm:hidden block">{format(booking.startDate, "PPPp")}</p>
                              <p className="sm:hidden block">{format(booking.endDate, "PPPp")}</p>

                              <p className="text-pretty text-sm font-semibold">
                                {formatCurrency(Number(booking.totalAmount))}
                                {/* <span className="inline-flex items-center px-1">.</span>
                              <span className=" text-gray-500">{formatDate(booking.createdAt)}</span> */}
                              </p>

                              {/* {booking.chauffeur ? (
                                <p>
                                  Your chauffeur{" "}
                                  {["CANCELLED", "COMPLETED"].includes(booking.status) ? "was" : "is"}{" "}
                                  {booking.chauffeur.name}
                                </p>
                              ) : (
                                <p>Chauffeur not assigned yet</p>
                              )} */}
                            </div>
                          </div>
                        </Link>

                        <div className="flex sm:flex-row flex-col gap-2 sm:mt-0 mt-2 items-center justify-center">
                          {getLegExtendableDuration(booking) > 0 && (
                            <Link
                              to={`/bookings/${booking.id}/extend${guestEmail ? `?email=${guestEmail}` : ""}`}
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
                                          <label className="text-sm font-medium">Pickup Time</label>
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
