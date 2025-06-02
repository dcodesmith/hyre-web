import type { BookingLeg, Prisma, User as PrismaUser } from "@prisma/client";
import { ActionFunctionArgs, LoaderFunctionArgs, json } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData, useSearchParams } from "@remix-run/react";
import { format, isToday } from "date-fns";
import { AlertCircle, Calendar, CheckCircle, Clock, CreditCard, MapPin, User } from "lucide-react";
import { useEffect, useState } from "react";
import invariant from "tiny-invariant";
import { AutocompleteAddress } from "~/components/AutocompleteAddress";
import { BookingTimeSelect } from "~/components/BookingTimeSelect";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
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
import { Separator } from "~/components/ui/separator";
import logger from "~/lib/logger.server";
import {
  formatCurrency,
  getCustomerDetails,
  getLegExtendableDuration,
  isBookingEditable,
  normaliseBookingDetails,
} from "~/lib/utils";
import { getSessionUser, requireUser } from "~/modules/auth/auth.server";
import { prisma } from "~/modules/db/db.server";
import { sendEmail } from "~/modules/email/email.server";
import {
  renderFleetOwnerBookingCancellationEmail,
  renderUserBookingCancellationEmail,
} from "~/modules/email/templates/booking-notification";
import { sendMessage, Template } from "~/modules/messaging/messaging.server";
import { emailQueue } from "~/queues/email-throttle.server";
import { cancelBooking, getBooking } from "~/services/bookings.server";
import { BookingLegWithRelations, BookingWithRelations } from "~/types";

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
  let sessionUser: PrismaUser | null = null;

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
          car: { include: { owner: true } },
          chauffeur: true,
          legs: {
            include: {
              extensions: true,
            },
          },
        },
      });

      const { email } = getCustomerDetails(updatedBooking);
      const { carName } = normaliseBookingDetails(updatedBooking);

      emailQueue.add(async () => {
        logger.info(`Sending booking update email to ${email}`);

        await sendEmail({
          to: email,
          subject: "Booking Updated",
          html: `Your booking for ${carName} has been updated.`,
        });
      });

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
            amount: booking.totalAmount.toNumber(),
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

      const bookingDetails = normaliseBookingDetails(booking);
      const { email } = getCustomerDetails(booking);

      emailQueue.add(async () => {
        logger.info(`Sending booking cancellation email to ${email}`);

        await sendMessage({
          variables: {
            "1": bookingDetails.customerName,
            "2": bookingDetails.carName,
            "3": bookingDetails.totalAmount,
            "4": bookingDetails.cancellationReason,
            "5": bookingDetails.startDate,
            "6": bookingDetails.endDate,
            "7": bookingDetails.pickupLocation,
            "8": bookingDetails.returnLocation,
          },
          templateKey: Template.BookingCancellationClient,
        });

        await sendEmail({
          to: email,
          subject: "Booking Cancelled",
          html: await renderUserBookingCancellationEmail(bookingDetails),
        });
      });

      emailQueue.add(async () => {
        logger.info(`Sending booking cancellation email to ${booking.car.owner.email}`);

        await sendMessage({
          variables: {
            "1": bookingDetails.ownerName,
            "2": bookingDetails.carName,
            "3": bookingDetails.cancellationReason,
            "4": bookingDetails.customerName,
            "5": bookingDetails.startDate,
            "6": bookingDetails.endDate,
            "7": bookingDetails.pickupLocation,
            "8": bookingDetails.returnLocation,
            "9": bookingDetails.totalAmount,
          },
          templateKey: Template.BookingCancellationFleetOwner,
        });

        await sendEmail({
          to: booking.car.owner.email,
          subject: "Booking Cancelled by User",
          html: await renderFleetOwnerBookingCancellationEmail(bookingDetails),
        });
      });

      await emailQueue.onIdle();
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
      chauffeur: true,
      legs: {
        orderBy: { legDate: "asc" },
        include: {
          extensions: {
            where: { status: "ACTIVE", paymentStatus: "PAID" },
          },
        },
      },
    },
  });

  if (!booking) {
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

  logger.info(`booking: ${JSON.stringify(booking, null, 2)}`);

  return json({ booking });
}

const BookingLegTimeline = ({
  leg,
  index,
  booking,
}: { leg: BookingLegWithRelations; index: number; booking: BookingWithRelations }) => {
  const legDate = new Date(leg.legDate);
  const legEndTime = new Date(leg.legEndTime);
  const extendedDuration = leg.extensions.reduce(
    (acc, { extendedDurationHours }) => acc + extendedDurationHours,
    0,
  );

  return (
    <div key={leg.id} className="space-y-3">
      <div className="flex items-center gap-2">
        <h4
          className={`text-sm font-semibold ${isToday(legDate) ? "text-slate-700" : "text-slate-400"}`}
        >
          Day {index + 1} - {format(legDate, "EEEE, MMMM do, yyyy")}
        </h4>
        <Badge
          variant="outline"
          className={`text-xs rounded-sm ${
            isToday(legDate)
              ? "bg-blue-50 text-blue-700 border-blue-200"
              : legDate < new Date()
                ? "bg-green-50 text-green-700 border-green-200"
                : "bg-slate-50 text-slate-700 border-slate-200"
          }`}
        >
          {isToday(legDate) ? "Active" : legDate < new Date() ? "Completed" : "Upcoming"}
        </Badge>
      </div>

      <div className="flex items-start gap-4">
        <div className="flex flex-col mt-1 items-center">
          <div
            className={`w-3 h-3 rounded-full ${isToday(legDate) ? "bg-green-500" : "bg-slate-300"}`}
          />
          <div className={`w-px h-8 ${isToday(legDate) ? "bg-slate-200" : "bg-slate-100"}`} />
          <div
            className={`w-3 h-3 rounded-full ${isToday(legDate) ? "bg-red-500" : "bg-slate-300"}`}
          />
        </div>
        <div className="flex-1 space-y-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`text-sm font-medium ${isToday(legDate) ? "text-green-600" : "text-slate-400"}`}
              >
                Pickup
              </span>
              <Badge
                variant="outline"
                className={`text-sm font-semibold rounded-sm ${isToday(legDate) ? "" : "border-slate-200 text-slate-400"}`}
              >
                {format(new Date(booking.startDate), "h:mm a")}
              </Badge>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`text-sm font-medium ${isToday(legDate) ? "text-red-600" : "text-slate-400"}`}
              >
                Return
              </span>
              <Badge
                variant="outline"
                className={`text-sm font-semibold rounded-sm ${isToday(legDate) ? "" : "border-slate-200 text-slate-400"}`}
              >
                {extendedDuration > 0
                  ? `${format(legEndTime, "h:mm a")} (Extended)`
                  : format(new Date(booking.endDate), "h:mm a")}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {extendedDuration > 0 ? (
        <Alert
          className={`${isToday(legDate) ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-100"} rounded-sm`}
        >
          <AlertDescription
            className={`text-sm ${isToday(legDate) ? "text-amber-800" : "text-slate-600 line-through"}`}
          >
            Your drop-off time
            {isToday(legDate) ? " has been" : " was"} extended by {extendedDuration}{" "}
            {extendedDuration === 1 ? "hour" : "hours"} from{" "}
            {format(new Date(booking.endDate), "p")} to {format(legEndTime, "p")}
          </AlertDescription>
        </Alert>
      ) : (
        <p className={`text-sm ${isToday(legDate) ? "text-slate-600" : "text-slate-400"}`}>
          Standard 12-hour service
        </p>
      )}

      {index < booking.legs.length - 1 && <Separator />}
    </div>
  );
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
  const extendableDuration = getLegExtendableDuration(booking);

  useEffect(() => {
    if (actionData && "success" in actionData && actionData.success) {
      setIsDialogOpen(false);
    }
  }, [actionData]);

  return (
    <div className="min-h-screen  p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-bold text-slate-900">Booking Details</h1>
            <p className="text-sm text-slate-600 mt-1">
              {booking.car.make} {booking.car.model} {booking.car.year} - {booking.car.color}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className="text-sm bg-green-100 text-green-800 border-green-200 rounded-sm capitalize"
            >
              <CheckCircle className="w-3 h-3 mr-1" />
              {booking.status.toLowerCase()}
            </Badge>
            <Badge
              variant="outline"
              className="text-sm bg-blue-100 text-blue-800 border-blue-200 rounded-sm capitalize"
            >
              <CreditCard className="w-3 h-3 mr-1" />
              {booking.paymentStatus.toLowerCase()}
            </Badge>
          </div>
        </div>

        <Alert className="border-blue-200 bg-blue-50 rounded-sm">
          <AlertDescription className="text-sm text-blue-800">
            {booking.type === "DAY"
              ? "Each booking day is for a 12-hour duration ending 12 hours after the start time unless extended."
              : "Each night booking is for a 6-hour duration starting at 11pm."}
          </AlertDescription>
        </Alert>

        <div className="grid lg:grid-cols-3 gap-4 md:gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="rounded">
              <CardHeader className="p-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  Trip Timeline
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="space-y-6">
                  {booking.legs.map((leg, index) => {
                    return (
                      <BookingLegTimeline key={leg.id} leg={leg} index={index} booking={booking} />
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded">
              <CardHeader className="p-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <MapPin className="w-5 h-5 text-blue-600" />
                  Location Details
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2" />
                    <div>
                      <p className="text-sm font-medium text-slate-600">Pickup Location</p>
                      <p className="text-sm font-semibold text-slate-900">
                        {booking.pickupLocation}
                      </p>
                    </div>
                  </div>
                  <Separator />
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-red-500 rounded-full mt-2" />
                    <div>
                      <p className="text-sm font-medium text-slate-600">Return Location</p>
                      <p className="text-sm font-semibold text-slate-900">
                        {booking.returnLocation}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="rounded">
              <CardHeader className="p-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <User className="w-5 h-5 text-blue-600" />
                  Your Chauffeur
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="flex items-center gap-3">
                  <Avatar className="w-12 h-12">
                    <AvatarImage alt={booking.chauffeur?.name || "Not Assigned"} />
                    <AvatarFallback>
                      {booking.chauffeur?.name
                        ? booking.chauffeur.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                        : "NA"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {booking.chauffeur?.name || "Not Assigned"}
                    </p>
                    <p className="text-sm text-slate-600">Professional Chauffeur</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded">
              <CardHeader className="p-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CreditCard className="w-5 h-5 text-blue-600" />
                  Payment Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-600">
                      Base Rate ({booking.type === "DAY" ? "12 hours" : "6 hours"})
                    </span>
                    <span className="text-sm font-medium">
                      {formatCurrency(Number(booking.totalAmount))}
                    </span>
                  </div>
                  {booking.legs.some((leg) => leg.extensions.length > 0) && (
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-600">
                        Extension (
                        {booking.legs.reduce(
                          (acc, leg) =>
                            acc +
                            leg.extensions.reduce((sum, ext) => sum + ext.extendedDurationHours, 0),
                          0,
                        )}{" "}
                        hours)
                      </span>
                      <span className="text-sm font-medium">
                        {formatCurrency(
                          booking.legs.reduce(
                            (acc, leg) =>
                              acc +
                              leg.extensions.reduce((sum, ext) => sum + Number(ext.totalAmount), 0),
                            0,
                          ),
                        )}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-600">Service Fee</span>
                    <span className="text-sm font-medium">
                      {formatCurrency(Number(booking.totalAmount) * 0.15)}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-bold">
                    <span>Total Amount</span>
                    <span className="text-green-600">
                      {formatCurrency(Number(booking.totalAmount))}
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-sm w-full justify-center bg-green-100 text-green-800 border-green-200 rounded-sm"
                  >
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Payment Completed
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded">
              <CardContent className="p-4">
                <div className="space-y-2">
                  {extendableDuration > 0 && (
                    <Link
                      to={`/bookings/${booking.id}/extend${guestEmail ? `?email=${guestEmail}` : ""}`}
                      className="p-2 border rounded text-center flex items-center justify-center w-full"
                    >
                      Extend Booking for up to {extendableDuration}{" "}
                      {extendableDuration === 1 ? "hour" : "hours"}
                    </Link>
                  )}

                  {booking.status === "CONFIRMED" &&
                    isBookingEditable(new Date(booking.startDate)) && (
                      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" className="text-sm w-full rounded-sm">
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
                          <Form method="PATCH" className="space-y-4" key={booking.id}>
                            <div className="grid gap-4 py-4">
                              {booking.type === "DAY" && (
                                <div className="space-y-2">
                                  <Label htmlFor="pickupTime">Pickup Time</Label>
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
                                <Label htmlFor="pickupAddress">Pickup Address</Label>
                                <AutocompleteAddress
                                  id="pickupAddress"
                                  inputProps={{
                                    name: "pickupAddress",
                                    id: "pickupAddress",
                                    defaultValue: booking.pickupLocation,
                                    placeholder: "Enter pickup address",
                                  }}
                                  onSelect={(place: any) => {
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
                                  <Label htmlFor="dropOffAddress">Drop-off Address</Label>
                                  <AutocompleteAddress
                                    id="dropOffAddress"
                                    inputProps={{
                                      name: "dropOffAddress",
                                      id: "dropOffAddress",
                                      defaultValue: booking.returnLocation,
                                      placeholder: "Enter drop-off address",
                                    }}
                                    onSelect={(place: any) => {
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
                          </Form>
                        </DialogContent>
                      </Dialog>
                    )}

                  <Button variant="outline" size="sm" className="text-sm w-full rounded-sm">
                    Download Receipt
                  </Button>

                  {booking.status === "CONFIRMED" &&
                    isBookingEditable(new Date(booking.startDate)) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-sm w-full rounded-sm text-red-600 hover:text-red-700"
                      >
                        Cancel Booking
                      </Button>
                    )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
