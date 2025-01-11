import { ActionFunctionArgs, LoaderFunctionArgs, json } from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import { useEffect, useState } from "react";
import invariant from "tiny-invariant";
import { BookingTimeSelect } from "~/components/BookingTimeSelect";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { formatCurrency } from "~/lib/utils";
import { isBookingEditable } from "~/lib/utils";
import { requireUser } from "~/modules/auth/auth.server";
import { prisma } from "~/modules/db/db.server";
import { sendEmail } from "~/modules/email/email.server";
import {
  renderBookingCancellationEmail,
  renderFleetOwnerBookingCancellationEmail,
} from "~/modules/email/templates/booking-notification";
import { cancelBooking, getBooking } from "~/services/bookings.server";

export async function action({ request, params }: ActionFunctionArgs) {
  const user = await requireUser(request, {
    redirectTo: `/auth?redirectTo=/bookings/${params.id}`,
  });

  invariant(params.id, "Booking ID is required");

  if (request.method === "PATCH") {
    const formData = await request.formData();
    const pickupTime = String(formData.get("pickupTime"));
    const pickupStreet = String(formData.get("pickupStreet"));
    const pickupLocality = String(formData.get("pickupLocality"));
    const sameLocation = String(formData.get("sameLocation"));
    const dropOffStreet = String(formData.get("dropOffStreet"));
    const dropOffLocality = String(formData.get("dropOffLocality"));

    const currentBooking = await getBooking(params.id);

    // Verify booking belongs to user
    if (currentBooking.userId !== user.id) {
      return json({ error: "Unauthorized" }, { status: 403 });
    }

    const startDate = new Date(currentBooking.startDate);

    // Parse the time from pickupTime (e.g. "8:00 AM")
    const [time, period] = pickupTime.split(" ");
    const [hours, minutes] = time.split(":");

    // Convert 12-hour format to 24-hour
    let hour = Number.parseInt(hours);
    if (period === "PM" && hour !== 12) {
      hour += 12;
    }

    startDate.setHours(hour);
    startDate.setMinutes(Number.parseInt(minutes));

    // Calculate endDate as 12 hours after startDate
    const endDate = new Date(startDate);
    endDate.setHours(startDate.getHours() + 12);

    if (!isBookingEditable(startDate)) {
      return json(
        { error: "Bookings cannot be edited within 12 hours of start time" },
        { status: 400 },
      );
    }

    const pickupLocation = `${pickupStreet}, ${pickupLocality}`;
    const returnLocation =
      sameLocation === "true" ? pickupLocation : `${dropOffStreet}, ${dropOffLocality}`;

    try {
      const booking = await prisma.booking.update({
        where: { id: params.id },
        data: {
          startDate,
          endDate,
          pickupLocation,
          returnLocation,
        },
        include: {
          user: true,
          car: true,
          chauffeur: true,
        },
      });

      // Optionally send email notification about booking update
      await sendEmail({
        to: booking.user.email,
        subject: "Booking Updated",
        html: `Your booking for ${booking.car.make} ${booking.car.model} has been updated.`,
      });

      return json({ success: true, booking });
    } catch (error) {
      return json({ error: "Failed to update booking" }, { status: 500 });
    }
  }

  if (request.method === "DELETE") {
    try {
      const booking = await cancelBooking(params.id, "User requested cancellation");

      const options = {
        method: "POST",
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: booking.totalAmount,
          comments: "Refund from booking cancellation",
          callbackurl: "https://webhook.site/5f9a659a-11a2-4925-89cf-8a59ea6a019a", // Implement webhook endpoint for refund
        }),
      };

      const response = await fetch(
        `https://api.flutterwave.com/v3/transactions/${booking.paymentId}/refund`,
        options,
      );

      console.log(await response.json());

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
  const [showDropoffFields, setShowDropoffFields] = useState(
    booking.pickupLocation !== booking.returnLocation,
  );
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const actionData = useActionData<typeof action>();

  useEffect(() => {
    if (actionData && "success" in actionData && actionData.success) {
      setIsDialogOpen(false);
    }
  }, [actionData]);

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-bold">Booking Details</h2>
        <p className="font-medium text-gray-600">
          {booking.car.make} {booking.car.model} {booking.car.year} - {booking.car.color}
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
            <p className="font-medium">{formatCurrency(Number(booking.totalAmount))}</p>
          </div>

          {booking.status === "CANCELLED" && (
            <>
              <div>
                <h3 className="text-gray-500">Cancellation Reason</h3>
                <p className="font-medium">{booking.cancellationReason}</p>
              </div>
              <div>
                <h3 className="text-gray-500">Cancellation Date</h3>
                <p className="font-medium">{formatDate(booking.cancelledAt || "")}</p>
              </div>
            </>
          )}
        </div>
      </div>

      {booking.status === "CONFIRMED" && isBookingEditable(new Date(booking.startDate)) && (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full mt-4">
              Edit Booking
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>
                {booking.car.make} {booking.car.model} {booking.car.year}
              </DialogTitle>
            </DialogHeader>
            <Form method="PATCH" className="space-y-4">
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Pickup Time</label>
                  <BookingTimeSelect
                    date={new Date(booking.startDate)}
                    defaultValue={new Date(booking.startDate).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "numeric",
                      hour12: true,
                    })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Pickup Street Address</label>
                  <Input
                    name="pickupStreet"
                    defaultValue={booking.pickupLocation.split(", ")[0]}
                    placeholder="Enter street address"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Pickup Locality/Area</label>
                  <Input
                    name="pickupLocality"
                    defaultValue={booking.pickupLocation.split(", ")[1]}
                    placeholder="Enter locality or area"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="sameLocation"
                      name="sameLocation"
                      defaultChecked={booking.pickupLocation === booking.returnLocation}
                      onCheckedChange={(checked) => setShowDropoffFields(!checked)}
                    />
                    <Label htmlFor="sameLocation">Drop-off location same as pickup</Label>
                  </div>
                </div>

                {showDropoffFields && (
                  <div className="dropoff-fields space-y-4" id="dropoffFields">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Drop-off Street Address</label>
                      <Input
                        name="dropOffStreet"
                        defaultValue={booking.returnLocation.split(", ")[0]}
                        placeholder="Enter drop-off street address"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Drop-off Locality/Area</label>
                      <Input
                        name="dropOffLocality"
                        defaultValue={booking.returnLocation.split(", ")[1]}
                        placeholder="Enter drop-off locality or area"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" type="button" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save Changes</Button>
              </div>
            </Form>
          </DialogContent>
        </Dialog>
      )}
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
