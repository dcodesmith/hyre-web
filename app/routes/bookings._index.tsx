import { ActionFunctionArgs, json, type LoaderFunctionArgs } from "@remix-run/node";
import {
  Link,
  redirect,
  useFetcher,
  useLoaderData,
  useNavigate,
  useSearchParams,
} from "@remix-run/react";
import invariant from "tiny-invariant";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { formatCurrency, formatDate } from "~/lib/utils";
import { requireUser } from "~/modules/auth/auth.server";
import { sendEmail } from "~/modules/email/email.server";
import {
  renderBookingConfirmationEmail,
  renderFleetOwnerBookingNotificationEmail,
} from "~/modules/email/templates/booking-notification";
import { cancelBooking, confirmBooking, getBookingsByStatus } from "~/services/bookings.server";
import { requireUserWithRole } from "~/utils/permissions.server";

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser(request, {
    redirectTo: `/auth?redirectTo=/bookings`,
  });

  if (request.method === "DELETE") {
    const formData = await request.formData();
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

    const formData = await request.formData();

    // TODO:for security reasons, we need to do another validation to check that booking is still available
    // because the user might have changed the dates in the form

    const pickupStreet = String(formData.get("pickupStreet"));
    const pickupLocality = String(formData.get("pickupLocality"));
    const sameLocation = formData.get("sameLocation");
    const pickupTime = String(formData.get("pickupTime"));
    const dropOffStreet = String(formData.get("dropOffStreet"));
    const dropOffLocality = String(formData.get("dropOffLocality"));
    const carId = String(formData.get("carId"));
    const paymentId = String(formData.get("paymentId"));

    // Parse the time from pickupTime (e.g. "8:00 AM") and set it on startDate
    const [time, period] = pickupTime.split(" ");
    const [hours, minutes] = time.split(":");
    const startDateTime = new Date(startDate);

    // Convert 12-hour format to 24-hour
    let hour = parseInt(hours);

    if (period === "PM" && hour !== 12) {
      hour += 12;
    }

    startDateTime.setHours(hour);
    startDateTime.setMinutes(parseInt(minutes));
    startDateTime.setSeconds(0);
    startDateTime.setMilliseconds(0);

    // Set end date time to 12 hours after start time
    const endDateTime = new Date(endDate);
    endDateTime.setHours(startDateTime.getHours() + 12);
    endDateTime.setMinutes(startDateTime.getMinutes());
    endDateTime.setSeconds(0);
    endDateTime.setMilliseconds(0);

    const pickupLocation = `${pickupStreet}, ${pickupLocality}`;
    const returnLocation = sameLocation ? pickupLocation : `${dropOffStreet}, ${dropOffLocality}`;

    try {
      const booking = await confirmBooking({
        startDate: startDateTime,
        endDate: endDateTime,
        carId,
        userId: user.id,
        pickupLocation,
        returnLocation,
        paymentId,
      });

      await Promise.all([
        sendEmail({
          to: booking.user.email,
          subject: "Booking confirmed",
          html: await renderBookingConfirmationEmail(booking),
        }),
        sendEmail({
          to: "dcodesmith@gmail.com", // booking.car.owner.email,
          subject: "New booking alert",
          html: await renderFleetOwnerBookingNotificationEmail(booking),
        }),
      ]);

      return redirect(`/bookings/${booking.id}`);
    } catch (error) {
      return json({ error }, { status: 400 });
    }
  }

  return json({ error: "Invalid request method" }, { status: 405 });
}

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUserWithRole(request, "user");

  const bookings = await getBookingsByStatus(user.id);

  return json({ bookings });
}

export default function BookingsPage() {
  const { bookings } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [searchParams] = useSearchParams();
  const status = searchParams.get("status")?.toLocaleUpperCase() ?? "ACTIVE";

  const navigate = useNavigate();
  const statuses = ["ACTIVE", "CONFIRMED", "COMPLETED", "CANCELLED"] as const;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Your Bookings</h2>

      <Tabs defaultValue={status} className="w-full">
        <TabsList className="flex overflow-x-auto justify-evenly">
          {statuses.map((status) => (
            <TabsTrigger
              className="whitespace-nowrap w-full gap-1 antialiased"
              key={status}
              value={status}
              onClick={() => {
                navigate(`/bookings?status=${status.toLocaleLowerCase()}`);
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
              {bookings[status]?.map((booking) => (
                <div key={booking.id} className="border flex justify-between p-2 rounded">
                  <div className="flex items-center gap-4">
                    <img
                      src={booking.car.images[0]}
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
                      to={`/bookings/${booking.id}`}
                      className="text-blue-500 hover:text-blue-700"
                    >
                      View
                    </Link>

                    {["PENDING", "CONFIRMED"].includes(booking.status) && (
                      <button
                        className="bg-red-500 text-white px-4 py-2 rounded"
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
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {(!bookings[status] || bookings[status].length === 0) && (
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
