import {
  ActionFunctionArgs,
  json,
  type LoaderFunctionArgs,
} from "@remix-run/node";
import { Link, useFetcher, useLoaderData } from "@remix-run/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { cancelBooking, getBookingsByStatus } from "~/services/bookings.server";
import { requireUserWithRole } from "~/utils/permissions.server";
import { formatCurrency, formatDate } from "~/lib/utils";
import invariant from "tiny-invariant";

export async function action({ request }: ActionFunctionArgs) {
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

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUserWithRole(request, "user");
  const bookings = await getBookingsByStatus(user.id);

  return json({ bookings });
}

export default function DashboardRoute() {
  const { bookings } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();

  const statuses = [
    "ACTIVE",
    "PENDING",
    "CONFIRMED",
    "COMPLETED",
    "CANCELLED",
  ] as const;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Your Bookings</h2>

      <Tabs defaultValue="ACTIVE" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          {statuses.map((status) => (
            <TabsTrigger key={status} value={status}>
              {status.charAt(0) + status.slice(1).toLowerCase()}
              <span className="ml-2 text-sm text-gray-500">
                ({bookings[status]?.length || 0})
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {statuses.map((status) => (
          <TabsContent key={status} value={status}>
            <div className="flex flex-col gap-2">
              {bookings[status]?.map((booking) => (
                <div
                  key={booking.id}
                  className="border flex justify-between p-2 rounded"
                >
                  <div className="flex items-center gap-4">
                    <img
                      src={booking.car.images[0]}
                      alt="Order Thumbnail"
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <div>
                      <h3 className="text-pretty text-sm font-semibold">
                        {booking.car.make} {booking.car.model} (
                        {booking.car.year})
                      </h3>
                      <div className="text-sm text-gray-600">
                        <p>
                          {formatDate(booking.startDate)} to{" "}
                          {formatDate(booking.endDate)}
                        </p>

                        <p className="text-pretty text-sm font-semibold">
                          {formatCurrency(Number(booking.totalAmount))}
                          <span className="inline-flex items-center px-1">
                            .
                          </span>
                          <span className=" text-gray-500">
                            {formatDate(booking.updatedAt)}
                          </span>
                        </p>

                        {booking.chauffeur ? (
                          <p>Your chauffeur is {booking.chauffeur.name}</p>
                        ) : (
                          <p>Chauffeur not assigned yet</p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 items-center">
                    <Link
                      to={`/bookings/${booking.id}`}
                      className="text-blue-500 hover:text-blue-700"
                    >
                      View Booking
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
                            }
                          )
                        }
                      >
                        Cancel Booking
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
