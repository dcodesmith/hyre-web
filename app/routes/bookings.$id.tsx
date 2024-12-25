import { ActionFunctionArgs, json, LoaderFunctionArgs } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { closePaymentModal, useFlutterwave } from "flutterwave-react-v3";
import invariant from "tiny-invariant";
import { Button } from "~/components/ui/button";
import { formatCurrency } from "~/lib/utils";
import { requireUser } from "~/modules/auth/auth.server";
import { sendEmail } from "~/modules/email/email.server";
import {
  renderBookingCancellationEmail,
  renderBookingConfirmationEmail,
  renderFleetOwnerBookingCancellationEmail,
  renderFleetOwnerBookingNotificationEmail,
} from "~/modules/email/templates/booking-notification";
import {
  cancelBooking,
  confirmBooking,
  createBooking,
  getBooking,
} from "~/services/bookings.server";

export async function action({ request, params }: ActionFunctionArgs) {
  const user = await requireUser(request, {
    redirectTo: `/auth?redirectTo=/cars/${params.id}`,
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

  if (request.method === "POST") {
    invariant(params.id, "Car ID is required");

    const url = new URL(request.url);
    const startDate = url.searchParams.get("from");
    const endDate = url.searchParams.get("to");

    invariant(startDate, "From Date is required");
    invariant(endDate, "To Date is required");

    const formData = await request.formData();

    // TODO:for security reasons, we need to do another validation to check that booking is still available
    // because the user might have changed the dates in the form

    // const startDate = new Date(String(formData.get("startDate")));
    // const endDate = new Date(String(formData.get("endDate")));
    const pickupStreet = String(formData.get("pickupStreet"));
    const pickupLocality = String(formData.get("pickupLocality"));
    const sameLocation = formData.get("sameLocation");
    const pickupTime = String(formData.get("pickupTime"));
    const dropOffStreet = String(formData.get("dropOffStreet"));
    const dropOffLocality = String(formData.get("dropOffLocality"));

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
    const returnLocation = sameLocation
      ? pickupLocation
      : `${dropOffStreet}, ${dropOffLocality}`;

    try {
      const booking = await createBooking({
        startDate: startDateTime,
        endDate: endDateTime,
        carId: params.id,
        userId: user.id,
        pickupLocation,
        returnLocation,
      });

      return json({ booking });
      // return redirect(`/payment?bookingId=${booking.id}`);
    } catch (error) {
      return json({ error }, { status: 400 });
    }
  }

  if (request.method === "PATCH") {
    invariant(params.id, "Booking ID is required");

    const formData = await request.formData();
    const transactionId = String(formData.get("transactionId"));

    try {
      const booking = await confirmBooking(params.id, transactionId);

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

      return json({ booking });
    } catch (error) {
      return json({ error }, { status: 500 });
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

const config = {
  public_key: "FLWPUBK_TEST-02b9b5fc6406bd4a41c3ff141cc45e93-X",
  tx_ref: "txref-DI0NzMx13",
  currency: "NGN",
  payment_options: "card,mobilemoney,ussd",
  customizations: {
    logo: "https://st2.depositphotos.com/4403291/7418/v/450/depositphotos_74189661-stock-illustration-online-shop-log.jpg",
  },
};

export default function Booking() {
  const { booking } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();

  const handlePayment = useFlutterwave({
    ...config,
    amount: 3000,
    customer: {
      email: "dcodesmith@gmail.com",
      phone_number: "070********",
      name: "Afees Adedamola Kolawole",
    },
    customizations: {
      title: `Booking Payment`,
      description: `Payment for ${booking?.car?.make} ${booking?.car?.model} rental`,
      logo: "https://picsum.photos/seed/car-rental/800/600",
    },
  });

  if (fetcher.state === "loading") {
    return <div>Loading...</div>;
  }

  const onMakePayment = () => {
    handlePayment({
      callback: ({ transaction_id: transactionId, status }) => {
        fetcher.submit(
          { transactionId, status },
          { method: "PATCH", action: `/bookings/${booking.id}` }
        );
        closePaymentModal();
      },
      onClose: () => {},
    });
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Booking Details</h2>
        <p className="font-medium">
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
              {booking.paymentStatus === "UNPAID" &&
                booking.status !== "CANCELLED" && (
                  <Button onClick={() => onMakePayment()}>Pay Now</Button>
                )}
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
