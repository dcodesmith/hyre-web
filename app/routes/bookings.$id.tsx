import { ActionFunctionArgs, json, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import invariant from "tiny-invariant";
import { formatCurrency } from "~/lib/utils";
import { requireUser } from "~/modules/auth/auth.server";
import { sendEmail } from "~/modules/email/email.server";
import {
  renderBookingCancellationEmail,
  renderFleetOwnerBookingCancellationEmail,
} from "~/modules/email/templates/booking-notification";
import { cancelBooking, getBooking } from "~/services/bookings.server";

export async function action({ request, params }: ActionFunctionArgs) {
  await requireUser(request, {
    redirectTo: `/auth?redirectTo=/bookings/${params.id}`,
  });

  invariant(params.id, "Booking ID is required");

  if (request.method === "DELETE") {
    try {
      const booking = await cancelBooking(
        params.id,
        "User requested cancellation"
      );

      await Promise.all([
        sendEmail({
          to: booking.user.email,
          subject: "Booking cancelled",
          html: await renderBookingCancellationEmail(booking),
        }),

        await sendEmail({
          to: booking.user.email,
          subject: "Booking cancelled",
          html: await renderFleetOwnerBookingCancellationEmail(booking),
        }),
      ]);

      return json({ success: true });
    } catch (error) {
      console.error(error);
      return json({ error: "Failed to delete car" }, { status: 500 });
    }
  }
}

export async function loader({ params }: LoaderFunctionArgs) {
  invariant(params.id, "Booking ID is required");

  const booking = await getBooking(params.id);

  if (!booking) {
    throw new Response("Booking not found", { status: 404 });
  }

  return json({ booking });
}

const formatDate = (date: string | Date) => {
  return new Date(date).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function Booking() {
  const { booking } = useLoaderData<typeof loader>();

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-bold">Booking Details</h2>
        <p className="font-medium text-gray-600">
          {booking.car.make} {booking.car.model} {booking.car.year} -{" "}
          {booking.car.color}
        </p>
      </div>
      <div className="bg-white p-6 space-y-4 border rounded overflow-hidden shadow-md hover:shadow-lg transition-shadow">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="text-gray-500">Pickup Date</h3>
            <p className="font-medium">{formatDate(booking.startDate)}</p>
          </div>

          <div>
            <h3 className="text-gray-500">Return Date</h3>
            <p className="font-medium">{formatDate(booking.endDate)}</p>
          </div>

          <div>
            <h3 className="text-gray-500">Pickup Location</h3>
            <p className="font-medium">{booking.pickupLocation}</p>
          </div>

          <div>
            <h3 className="text-gray-500">Return Location</h3>
            <p className="font-medium">{booking.returnLocation}</p>
          </div>

          <div>
            <h3 className="text-gray-500">Chauffeur</h3>
            <p className="font-medium">
              {booking.chauffeur ? `${booking.chauffeur.name}` : "Not Assigned"}
            </p>
          </div>

          <div>
            <h3 className="text-gray-500">Payment Status</h3>
            <div className="flex items-center gap-2">
              <p className="font-medium">{booking.paymentStatus}</p>
            </div>
          </div>

          <div>
            <h3 className="text-gray-500">Status</h3>
            <p className="font-medium">{booking.status}</p>
          </div>

          <div>
            <h3 className="text-gray-500">Total Amount</h3>
            <p className="font-medium">
              {formatCurrency(Number(booking.totalAmount))}
            </p>
          </div>

          {booking.status === "CANCELLED" && (
            <>
              <div>
                <h3 className="text-gray-500">Cancellation Reason</h3>
                <p className="font-medium">{booking.cancellationReason}</p>
              </div>
              <div>
                <h3 className="text-gray-500">Cancellation Date</h3>
                <p className="font-medium">
                  {formatDate(booking.cancelledAt || "")}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// export function ErrorBoundary() {
//   return (
//     <div className="max-w-3xl mx-auto p-6">
//       <h2 className="text-2xl font-bold text-red-600">Error</h2>
//       <p>Something went wrong while loading the booking details.</p>
//     </div>
//   );
// }
