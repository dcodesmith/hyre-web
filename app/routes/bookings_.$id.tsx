import { ActionFunctionArgs, LoaderFunctionArgs, json } from "@remix-run/node";
import { Form, useActionData, useLoaderData, Link, useSearchParams } from "@remix-run/react";
import { useEffect, useState } from "react";
import invariant from "tiny-invariant";
import type { User, Booking as PrismaBooking, Prisma } from "@prisma/client";
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
import { Label } from "~/components/ui/label";
import { formatCurrency, isBookingEditable, isBookingExtendable } from "~/lib/utils";
import { getSessionUser, requireUser } from "~/modules/auth/auth.server";
import { prisma } from "~/modules/db/db.server";
import { sendEmail } from "~/modules/email/email.server";
import {
  renderUserBookingCancellationEmail,
  renderFleetOwnerBookingCancellationEmail,
} from "~/modules/email/templates/booking-notification";
import { cancelBooking, getBooking } from "~/services/bookings.server";
import { AutocompleteAddress } from "~/components/AutocompleteAddress";
import { format } from "date-fns";

export async function action({ request, params }: ActionFunctionArgs) {
  invariant(params.id, "Booking ID is required");
  const bookingId = params.id;

  const currentBooking = await getBooking(bookingId);

  if (!currentBooking) {
    return json({ error: "Booking not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const guestEmail = url.searchParams.get("email");

  let isAuthorized = false;
  let sessionUser: User | null = null;

  if (guestEmail) {
    const bookingGuestDetails = currentBooking.guestUser as Prisma.JsonObject | null;
    const bookingGuestEmail = bookingGuestDetails?.email as string | undefined;

    if (bookingGuestEmail && bookingGuestEmail === guestEmail) {
      isAuthorized = true;
    } else {
      return json(
        { error: "Unauthorized: Invalid guest email for this booking action." },
        { status: 403 },
      );
    }
  } else {
    sessionUser = await requireUser(request, {
      redirectTo: `/auth?redirectTo=/bookings/${params.id}`,
    });
    if (currentBooking.userId === sessionUser.id) {
      isAuthorized = true;
    }
  }

  if (!isAuthorized) {
    return json({ error: "Unauthorized" }, { status: 403 });
  }

  if (request.method === "PATCH") {
    const formData = await request.formData();
    const pickupTime = formData.get("pickupTime")?.toString();
    const pickupAddress = formData.get("pickupAddress")?.toString();
    const sameLocation = formData.get("sameLocation") === "on";
    const dropOffAddressFromForm = formData.get("dropOffAddress")?.toString();

    let newStartDateForPatch: Date | undefined;
    let newEndDateForPatch: Date | undefined;

    if (pickupTime) {
      const baseDate = new Date(currentBooking.startDate);
      const [time, period] = pickupTime.split(" ");
      const [hoursStr, minutesStr] = time.split(":");
      const hours = Number.parseInt(hoursStr, 10);
      const minutes = Number.parseInt(minutesStr, 10);

      let hour24 = hours;
      if (period?.toUpperCase() === "PM" && hour24 !== 12) {
        hour24 += 12;
      } else if (period?.toUpperCase() === "AM" && hour24 === 12) {
        hour24 = 0;
      }

      if (!Number.isNaN(hour24) && !Number.isNaN(minutes)) {
        baseDate.setHours(hour24, minutes, 0, 0);
        newStartDateForPatch = new Date(baseDate);
        newEndDateForPatch = new Date(newStartDateForPatch);
        newEndDateForPatch.setHours(newStartDateForPatch.getHours() + 12);
      } else {
        return json({ error: "Invalid pickup time format." }, { status: 400 });
      }
    }

    const dateForEditCheck = newStartDateForPatch || new Date(currentBooking.startDate);

    if (!isBookingEditable(dateForEditCheck)) {
      return json(
        { error: "Bookings cannot be edited within 12 hours of start time." },
        { status: 400 },
      );
    }

    const newPickupLocationForUpdate =
      pickupAddress && pickupAddress !== currentBooking.pickupLocation ? pickupAddress : undefined;

    const finalEffectivePickupLocation =
      newPickupLocationForUpdate ?? currentBooking.pickupLocation;

    const targetReturnLocation = sameLocation
      ? finalEffectivePickupLocation
      : dropOffAddressFromForm || currentBooking.returnLocation;

    const newReturnLocationForUpdate =
      targetReturnLocation !== currentBooking.returnLocation ? targetReturnLocation : undefined;

    const updateData: Prisma.BookingUpdateInput = {
      ...(newStartDateForPatch && { startDate: newStartDateForPatch }),
      ...(newEndDateForPatch && { endDate: newEndDateForPatch }),
      ...(newPickupLocationForUpdate && { pickupLocation: newPickupLocationForUpdate }),
      ...(newReturnLocationForUpdate && { returnLocation: newReturnLocationForUpdate }),
    };

    if (Object.keys(updateData).length === 0) {
      return json({ success: true, booking: currentBooking, message: "No changes detected." });
    }

    try {
      const updatedBooking = await prisma.booking.update({
        where: { id: bookingId },
        data: updateData,
        include: {
          user: true,
          car: true,
          chauffeur: true,
        },
      });

      const recipientEmail =
        updatedBooking.user?.email ??
        ((updatedBooking.guestUser as Prisma.JsonObject)?.email as string | undefined);
      if (recipientEmail && updatedBooking.car) {
        await sendEmail({
          to: recipientEmail,
          subject: "Booking Updated",
          html: `Your booking for ${updatedBooking.car.make} ${updatedBooking.car.model} has been updated.`,
        });
      }

      return json({ success: true, booking: updatedBooking });
    } catch (error) {
      return json({ error: "Failed to update booking. Please try again." }, { status: 500 });
    }
  }

  if (request.method === "DELETE") {
    try {
      const booking = await cancelBooking(
        bookingId,
        sessionUser ? "User requested cancellation" : "Guest requested cancellation",
      );

      if (!booking) {
        return json({ error: "Booking not found or already cancelled" }, { status: 404 });
      }

      let refundSuccessful = false;
      if (booking.paymentId && booking.totalAmount.gt(0)) {
        const options = {
          method: "POST",
          headers: {
            accept: "application/json",
            Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: booking.totalAmount,
            comments: "Refund from booking cancellation by user",
          }),
        };

        const refundResponse = await fetch(
          `https://api.flutterwave.com/v3/transactions/${booking.paymentId}/refund`,
          options,
        );

        if (refundResponse.ok) {
          refundSuccessful = true;
        }
      }

      const emailPromises = [];
      const primaryRecipient =
        booking.user?.email ??
        ((booking.guestUser as Prisma.JsonObject)?.email as string | undefined);

      if (primaryRecipient) {
        emailPromises.push(
          sendEmail({
            to: primaryRecipient,
            subject: "Booking Cancelled",
            html: await renderUserBookingCancellationEmail(booking),
          }),
        );
      }

      if (booking.car?.owner) {
        emailPromises.push(
          sendEmail({
            to: booking.car.owner.email,
            subject: "Booking Cancelled by User",
            html: await renderFleetOwnerBookingCancellationEmail(booking),
          }),
        );
      }

      await Promise.all(emailPromises);

      return json({
        success: true,
        message: `Booking cancelled ${refundSuccessful ? "and refund initiated" : "successfully (refund not applicable or failed)"}.`,
      });
    } catch (error) {
      return json({ error: "Failed to cancel booking. Please try again." }, { status: 500 });
    }
  }

  return json({ error: "Method not allowed" }, { status: 405 });
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const guestEmail = url.searchParams.get("email");

  invariant(params.id, "Booking ID is required");
  const bookingId = params.id;

  let sessionUserFromLoader: User | null = null;
  if (!guestEmail) {
    sessionUserFromLoader = await getSessionUser(request);
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      car: true,
      user: true,
      extensions: true,
      chauffeur: true,
    },
  });

  if (!booking || !booking.car) {
    throw new Response("Booking not found", { status: 404 });
  }

  if (guestEmail) {
    const bookingGuestEmail = (booking.guestUser as Prisma.JsonObject | null)?.email as
      | string
      | undefined;
    if (!bookingGuestEmail || bookingGuestEmail !== guestEmail) {
      throw new Response("Unauthorized: Guest email does not match or not found.", { status: 403 });
    }
  } else if (sessionUserFromLoader) {
    if (booking.userId !== sessionUserFromLoader.id) {
      throw new Response("Unauthorized: Booking does not belong to this user.", { status: 403 });
    }
  } else {
    throw new Response("Unauthorized: Access denied.", { status: 401 });
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

export default function BookingDetails() {
  const { booking } = useLoaderData<typeof loader>();
  const [showDropoffFields, setShowDropoffFields] = useState(
    booking.pickupLocation !== booking.returnLocation,
  );
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const actionData = useActionData<typeof action>();
  const [searchParams] = useSearchParams();
  const guestEmail = searchParams.get("email");
  const now = new Date();

  useEffect(() => {
    if (actionData && "success" in actionData && actionData.success) {
      setIsDialogOpen(false);
    }
  }, [actionData]);

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-bold">Booking Details</h2>
        <p className="font-semibold">
          {booking.car.make} {booking.car.model} {booking.car.year} - {booking.car.color}
        </p>
      </div>
      <div className="bg-white p-6 space-y-4 border rounded overflow-hidden shadow-md hover:shadow-lg transition-shadow">
        <div className="sm:grid sm:grid-cols-2 gap-4 flex flex-col">
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
              <p className="font-medium capitalize">{booking.paymentStatus.toLowerCase()}</p>
            </div>
          </div>

          <div>
            <h3 className="text-gray-500">Status</h3>
            <p className="font-medium capitalize">{booking.status.toLowerCase()}</p>
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

          {booking.extensions && booking.extensions.length > 0 && (
            <div className="col-span-2 bg-gray-100 p-4 rounded-md">
              {booking.extensions.map((extension) => (
                <p key={extension.id} className="font-medium">
                  Your booking for {format(extension.day, "PPPP")} has been extended for{" "}
                  {extension.hours} hours to {format(extension.endDate, "p")} from{" "}
                  {format(booking.endDate, "p")}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {isBookingExtendable(booking) && (
          <Link
            to={`/bookings/${booking.id}/extend${guestEmail ? `?email=${guestEmail}` : ""}`}
            className="w-full  p-2 border rounded text-center"
          >
            Extend Booking
          </Link>
        )}

        {booking.status === "CONFIRMED" && isBookingEditable(new Date(booking.startDate)) && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full">
                Edit Booking
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
              <Form method="PATCH" className="space-y-4">
                <div className="grid gap-4 py-4">
                  {booking.type === "DAY" && (
                    <div className="space-y-2">
                      <Label htmlFor="pickupTime">Pickup Time</Label>
                      <BookingTimeSelect
                        date={new Date(booking.startDate)}
                        defaultValue={new Date(booking.startDate).toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "numeric",
                          hour12: true,
                        })}
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="pickupAddress">Pickup Address</Label>
                    <AutocompleteAddress
                      id="pickupAddress"
                      inputProps={{
                        name: "pickupAddress",
                        id: "pickupAddress",
                        defaultValue: booking.pickupLocation,
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
                        defaultChecked={booking.pickupLocation === booking.returnLocation}
                        onCheckedChange={(checked) => setShowDropoffFields(!checked)}
                      />
                      <Label htmlFor="sameLocation">Drop-off location same as pickup</Label>
                    </div>
                  </div>

                  {showDropoffFields && (
                    <div className="space-y-2">
                      <Label htmlFor="dropOffAddress">Drop-off Address</Label>
                      <AutocompleteAddress
                        id="dropOffAddress"
                        inputProps={{
                          name: "dropOffAddress",
                          id: "dropOffAddress",
                          defaultValue: booking.returnLocation,
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
    </div>
  );
}
