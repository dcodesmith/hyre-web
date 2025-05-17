import { Booking, BookingStatus, BookingType, Car, User, VehicleImage } from "@prisma/client";
import { ActionFunctionArgs, type LoaderFunctionArgs, json } from "@remix-run/node";
import {
  Link,
  redirect,
  useFetcher,
  useLoaderData,
  useNavigate,
  useSearchParams,
} from "@remix-run/react";
import { useEffect, useState } from "react";
import invariant from "tiny-invariant";
import { AutocompleteAddress } from "~/components/AutocompleteAddress";
import { BookingTimeSelect } from "~/components/BookingTimeSelect";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import logger from "~/lib/logger.server";
import { formatCurrency, formatDate, isBookingEditable, isBookingExtendable } from "~/lib/utils";
import { getSessionUser } from "~/modules/auth/auth.server";
import { prisma } from "~/modules/db/db.server";
import { sendEmail } from "~/modules/email/email.server";
import {
  renderBookingConfirmationEmail,
  renderFleetOwnerBookingNotificationEmail,
} from "~/modules/email/templates/booking-notification";
import { cancelBooking, confirmBooking, getBookingsByStatus } from "~/services/bookings.server";

type BookingWithRelations = Booking & {
  car: Car & { owner: User; images: VehicleImage[] };
  chauffeur?: User | null;
};

type GroupedBookings = {
  [K in BookingStatus]?: BookingWithRelations[];
};

export async function action({ request }: ActionFunctionArgs) {
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
    // const formData = await request.formData();
    const bookingId = String(formData.get("bookingId"));
    const reason = String(formData.get("reason"));

    invariant(bookingId, "Booking ID is required");
    invariant(reason, "Cancellation reason is required");

    try {
      await cancelBooking(bookingId, reason);
      return json({ success: true });
    } catch (error) {
      return json({ error: "Failed to cancel booking" }, { status: 500 });
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
      return json({ error: "End date cannot be before start date" }, { status: 400 });
    }

    const pickupAddress = String(formData.get("pickupAddress"));
    const sameLocation = formData.get("sameLocation");
    const pickupTime = String(formData.get("pickupTime"));
    const dropOffAddress = String(formData.get("dropOffAddress"));
    const carId = String(formData.get("carId"));
    const paymentId = String(formData.get("paymentId"));
    const bookingType = String(formData.get("bookingType"));

    // Check if guest email exists as a user
    if (guestEmail) {
      const existingUser = await prisma.user.findUnique({
        where: { email: String(guestEmail) },
      });

      if (existingUser) {
        return json(
          { error: "This email is registered to an existing user. Please login to continue." },
          { status: 400 },
        );
      }
    }

    // Parse the time from pickupTime (e.g. "8:00 AM") and set it on startDate
    const [time, period] = pickupTime.split(" ");
    const [hours, minutes] = time.split(":");
    const startDateTime = new Date(startDate);

    // Convert 12-hour format to 24-hour
    let hour = Number.parseInt(hours);

    if (period === "PM" && hour !== 12) {
      hour += 12;
    }

    startDateTime.setHours(bookingType === "NIGHT" ? 23 : hour);
    startDateTime.setMinutes(bookingType === "NIGHT" ? 0 : Number.parseInt(minutes));
    startDateTime.setSeconds(0);
    startDateTime.setMilliseconds(0);

    // Set end date time based on booking type
    const endDateTime = new Date(endDate);

    if (bookingType === "NIGHT") {
      endDateTime.setHours(startDateTime.getHours() + 6);
    } else {
      endDateTime.setHours(startDateTime.getHours() + 12);
    }
    endDateTime.setMinutes(startDateTime.getMinutes());
    endDateTime.setSeconds(0);
    endDateTime.setMilliseconds(0);

    if (
      startDateTime < now ||
      (startDateTime.toDateString() === now.toDateString() && now.getHours() >= 12)
    ) {
      return json(
        { error: "Start date and time cannot be after 12pm of the current day" },
        { status: 400 },
      );
    }

    const pickupLocation = pickupAddress;
    const returnLocation = sameLocation === "true" ? pickupAddress : dropOffAddress;

    logger.info(
      `Confirming booking ${JSON.stringify(
        {
          startDate: startDateTime,
          endDate: endDateTime,
          carId,
          user,
          pickupLocation,
          returnLocation,
          paymentId,
          type: bookingType,
        },
        null,
        2,
      )}`,
    );

    if (!user) {
      return json({ error: "User not found" }, { status: 400 });
    }

    try {
      const booking = await confirmBooking({
        startDate: startDateTime,
        endDate: endDateTime,
        carId,
        user,
        pickupLocation,
        returnLocation,
        paymentId,
        type: bookingType as BookingType,
      });

      await Promise.all([
        sendEmail({
          to: user.email,
          subject: "Booking confirmed",
          html: await renderBookingConfirmationEmail(booking),
        }),
        sendEmail({
          to: booking.car.owner.email,
          subject: "New booking alert",
          html: await renderFleetOwnerBookingNotificationEmail(booking),
        }),
      ]);

      if (guestEmail) {
        return redirect(`/bookings/${booking.id}?email=${encodeURIComponent(String(guestEmail))}`);
      }
      return redirect(`/bookings/${booking.id}`);
    } catch (error) {
      return json({ error }, { status: 400 });
    }
  }

  if (request.method === "GET") {
    const bookings = await getBookingsByStatus(user?.email!);
    return json({ bookings });
  }

  return json({ error: "Invalid request method" }, { status: 405 });
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const guestEmail = url.searchParams.get("email");
  // const user = await getSessionUser(request);

  // Get either guest user or authenticated user
  let user: User | null | { email: string; name?: string; phoneNumber?: string } = null;
  if (guestEmail) {
    user = { email: guestEmail };
  } else {
    user = await getSessionUser(request);
  }

  const email = guestEmail || user?.email;

  if (!email) {
    return json({ bookings: {} });
  }

  const bookings = await getBookingsByStatus(email, Boolean(guestEmail));

  return json({ bookings });
}

export default function BookingsPage() {
  const { bookings } = useLoaderData<{ bookings: GroupedBookings }>();
  const fetcher = useFetcher();
  const [searchParams] = useSearchParams();
  const status = searchParams.get("status")?.toLocaleUpperCase() ?? "ACTIVE";
  const navigate = useNavigate();
  const statuses = ["ACTIVE", "CONFIRMED", "COMPLETED", "CANCELLED"] as const;
  const [showDropoffFields, setShowDropoffFields] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const editFetcher = useFetcher<{ success: boolean }>();
  const now = new Date();

  useEffect(() => {
    if (editFetcher.data?.success) {
      setIsDialogOpen(false);
    }
  }, [editFetcher.data]);

  // Add check for guest email in search params
  const guestEmail = searchParams.get("email");

  // If no bookings and no guest email, show guest email form
  if (!Object.keys(bookings).length && !guestEmail) {
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
    <div>
      <h2 className="text-2xl font-bold mb-4">Your Bookings</h2>

      <Tabs defaultValue={status} className="w-full">
        <TabsList className="flex overflow-x-auto bg-white justify-start space-x-4 p-0">
          {statuses.map((status) => (
            <TabsTrigger
              className="whitespace-nowrap gap-1 antialiased rounded-full border data-[state=active]:border-primary data-[state=active]:border-1"
              key={status}
              value={status}
              onClick={() => {
                const newSearchParams = new URLSearchParams(searchParams);
                newSearchParams.set("status", status.toLowerCase());
                navigate(`/bookings?${newSearchParams.toString()}`);
              }}
            >
              {status.charAt(0) + status.slice(1).toLowerCase()}
              <span>({bookings[status]?.length || 0})</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {statuses.map((status) => (
          <TabsContent key={status} value={status}>
            <div className="flex flex-col gap-2">
              {bookings[status as BookingStatus]?.map((booking) => (
                <div key={booking.id} className="flex justify-between p-2">
                  <div className="flex items-center gap-4">
                    <img
                      src={booking.car.images[0].url}
                      alt={`${booking.car.make} ${booking.car.model}`}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <div>
                      <h3 className="text-pretty text-sm font-semibold">
                        {booking.car.make} {booking.car.model} ({booking.car.year})
                      </h3>
                      <div className="text-sm text-gray-600">
                        <p>
                          {formatDate(booking.startDate)} to {formatDate(booking.endDate)}
                        </p>

                        <p className="text-pretty text-sm font-semibold">
                          {formatCurrency(Number(booking.totalAmount))}
                          <span className="inline-flex items-center px-1">.</span>
                          <span className=" text-gray-500">{formatDate(booking.createdAt)}</span>
                        </p>

                        {booking.chauffeur ? (
                          <p>
                            Your chauffeur{" "}
                            {["CANCELLED", "COMPLETED"].includes(booking.status) ? "was" : "is"}{" "}
                            {booking.chauffeur.name}
                          </p>
                        ) : (
                          <p>Chauffeur not assigned yet</p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 items-center justify-center">
                    <Link
                      to={`/bookings/${booking.id}${guestEmail ? `?email=${guestEmail}` : ""}`}
                      className="text-blue-500 hover:text-blue-700"
                    >
                      View
                    </Link>

                    {booking.status === "ACTIVE" &&
                      booking.type === "DAY" &&
                      isBookingExtendable(booking) && (
                        <Link
                          to={`/bookings/${booking.id}/extend${guestEmail ? `?email=${guestEmail}` : ""}`}
                          className="text-green-500 hover:text-green-700"
                        >
                          Extend
                        </Link>
                      )}

                    {booking.status === "CONFIRMED" &&
                      isBookingEditable(new Date(booking.startDate)) && (
                        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="w-20">
                              Edit
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
                            >
                              <input type="hidden" name="bookingId" value={booking.id} />
                              <div className="grid gap-4 py-4">
                                {booking.type === "DAY" && (
                                  <div className="space-y-2">
                                    <label className="text-sm font-medium">Pickup Time</label>
                                    <BookingTimeSelect
                                      date={new Date(booking.startDate)}
                                      defaultValue={new Date(booking.startDate).toLocaleTimeString(
                                        "en-US",
                                        {
                                          hour: "numeric",
                                          minute: "numeric",
                                          hour12: true,
                                        },
                                      )}
                                    />
                                  </div>
                                )}

                                <div className="space-y-2">
                                  <label className="text-sm font-medium">Pickup Address</label>
                                  <AutocompleteAddress
                                    id="pickupAddress"
                                    inputProps={{
                                      name: "pickupAddress",
                                      // value: booking.pickupLocation,
                                      placeholder: "Enter pickup address",
                                    }}
                                    onSelect={(place) => {
                                      // Handle place selection if needed
                                    }}
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
                                      onCheckedChange={(checked) => setShowDropoffFields(!checked)}
                                    />
                                    <Label htmlFor="sameLocation">
                                      Drop-off location same as pickup
                                    </Label>
                                  </div>
                                </div>

                                {showDropoffFields && (
                                  <div className="space-y-2">
                                    <label className="text-sm font-medium">Drop-off Address</label>
                                    <AutocompleteAddress
                                      id="dropOffAddress"
                                      inputProps={{
                                        name: "dropOffAddress",
                                        // value: booking.returnLocation,
                                        placeholder: "Enter drop-off address",
                                      }}
                                      onSelect={(place) => {
                                        // Handle place selection if needed
                                      }}
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

                    {["PENDING", "CONFIRMED"].includes(booking.status) && (
                      <Button
                        variant="destructive"
                        className="w-20"
                        onClick={() =>
                          fetcher.submit(
                            {
                              bookingId: booking.id,
                              reason: "User requested cancellation",
                            },
                            {
                              method: "DELETE",
                              action: `/bookings/${booking.id}`,
                            },
                          )
                        }
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {(!bookings[status as BookingStatus] ||
                bookings[status as BookingStatus]?.length === 0) && (
                <div className="text-center py-8 text-gray-500">
                  No {status.toLowerCase()} bookings found
                </div>
              )}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
