import type { Prisma, User as PrismaUser } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { ActionFunctionArgs, LoaderFunctionArgs, json } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData, useSearchParams } from "@remix-run/react";
import { format, isToday } from "date-fns";
import { Calendar, CheckCircle, CreditCard, MapPin, User } from "lucide-react";
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
import { Template, sendMessage } from "~/modules/messaging/messaging.server";
import { emailQueue } from "~/queues/email-throttle.server";
import { cancelBooking, getBooking } from "~/services/bookings.server";
import { refundPayment, verifyRefund } from "~/services/payment.server";
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

      logger.info(`Booking paymentId: ${booking.paymentId}`);

      if (booking.paymentId && booking.totalAmount.gt(0)) {
        const callbackurl = `${process.env.APP_URL || process.env.NGROK_DOMAIN}/api/payments/webhook/flutterwave`;

        const refund = await refundPayment(
          booking.paymentId,
          booking.totalAmount.toNumber(),
          callbackurl,
        );

        if (refund.success && refund.refundId) {
          logger.info(
            `Refund successful for Booking ${booking.id}. Refund ID: ${refund.refundId}.`,
          );
        } else {
          logger.error(
            `Failed to initiate refund for booking ${booking.id}: ${refund.error}. MANUAL REFUND REQUIRED.`,
          );
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
        message: "Booking cancelled successfully.",
      });
    } catch (error) {
      return json({ error: "Failed to cancel booking. Please try again." }, { status: 500 });
    }
  }

  return json({ error: "Method not allowed" }, { status: 405 });
}

function createPaymentSummary(booking: BookingWithRelations) {
  // Use schema field names for clarity; map them from your original `netTotal` if different.
  // Example: const baseBookingNetTotal = new Decimal(booking.netTotal ?? 0);
  const baseBookingNetTotal = new Decimal(booking.netTotal ?? 0);
  const baseBookingServiceFee = new Decimal(booking.platformCustomerServiceFeeAmount ?? 0);
  const baseBookingVat = new Decimal(booking.vatAmount ?? 0);

  // Step 1: Sum up the net total and duration from all active extensions.
  // Using flatMap + reduce is more direct than nested reduce calls.
  const extensionSummary = booking.legs
    .flatMap((leg) => leg.extensions) // Get all extensions into a single array
    // .filter(ext => ext.status !== 'CANCELLED') // Optional: Exclude cancelled extensions
    .reduce(
      (acc, ext) => {
        // Use `itemsNetTotal` from the extension schema.
        acc.netTotal = acc.netTotal.plus(ext.netTotal ?? 0);
        acc.totalHours += ext.extendedDurationHours ?? 0;
        return acc;
      },
      { netTotal: new Decimal(0), totalHours: 0 },
    );

  // If there are no extensions, return the base booking's summary.
  if (extensionSummary.totalHours === 0) {
    return {
      netTotal: baseBookingNetTotal,
      platformCustomerServiceFeeAmount: baseBookingServiceFee,
      extensionNetTotal: new Decimal(0),
      totalExtendedHours: new Decimal(0),
      vatAmount: baseBookingVat,
      totalAmount: new Decimal(booking.totalAmount ?? 0),
    };
  }

  // Step 2: Calculate the service fee and VAT for the *extensions only*.
  const feeRatePercent = new Decimal(booking.platformCustomerServiceFeeRatePercent ?? 0).div(100);
  const vatRatePercent = new Decimal(booking.vatRatePercent ?? 0).div(100);

  const extensionServiceFee = extensionSummary.netTotal.mul(feeRatePercent);
  const extensionSubtotalBeforeVat = extensionSummary.netTotal.plus(extensionServiceFee);
  const extensionVat = extensionSubtotalBeforeVat.mul(vatRatePercent);

  // Step 3: Calculate the final grand totals by ADDING the base and extension components.
  const finalServiceFee = baseBookingServiceFee.plus(extensionServiceFee);
  const finalVat = baseBookingVat.plus(extensionVat);
  const finalNetTotal = baseBookingNetTotal.plus(extensionSummary.netTotal);
  const finalGrossTotal = finalNetTotal.plus(finalServiceFee).plus(finalVat);

  // Step 4: Return the final summary object, matching your original structure.
  return {
    netTotal: baseBookingNetTotal,
    platformCustomerServiceFeeAmount: finalServiceFee,
    extensionNetTotal: extensionSummary.netTotal,
    totalExtendedHours: new Decimal(extensionSummary.totalHours),
    vatAmount: finalVat,
    totalAmount: finalGrossTotal,
  };
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const guestEmail = url.searchParams.get("email");

  invariant(params.id, "Booking ID is required");
  const bookingId = params.id;

  let sessionUserFromLoader: PrismaUser | null = null;

  if (!guestEmail) {
    sessionUserFromLoader = await getSessionUser(request);
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      car: { include: { owner: true } },
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
    logger.error("Unauthorized: Access denied. No session user found.");
    throw new Response("Unauthorized: Access denied.", { status: 401 });
  }

  logger.info(`booking: ${JSON.stringify(booking, null, 2)}`);

  const paymentSummary = createPaymentSummary(booking);
  const extendableDuration = getLegExtendableDuration(booking);

  return json({ booking, paymentSummary, extendableDuration });
}

const TimePointRow = ({
  label,
  timeText,
  labelColorClassWhenStarted,
  isLegStarted,
}: {
  label: string;
  timeText: string;
  labelColorClassWhenStarted: string;
  isLegStarted: boolean;
}) => (
  <div>
    <div className="flex items-center gap-2 mb-1">
      <span
        className={`text-sm font-medium ${
          isLegStarted ? labelColorClassWhenStarted : "text-slate-400"
        }`}
      >
        {label}
      </span>
      <Badge
        variant="outline"
        className={`text-sm font-semibold rounded-sm ${
          isLegStarted ? "" : "border-slate-200 text-slate-400"
        }`}
      >
        {timeText}
      </Badge>
    </div>
  </div>
);

const BookingLegTimeline = ({
  leg,
  index,
  booking,
}: { leg: BookingLegWithRelations; index: number; booking: BookingWithRelations }) => {
  const legDate = new Date(leg.legDate);
  const legEndTime = new Date(leg.legEndTime);
  const legStartTime = new Date(leg.legStartTime);
  const bookingEndDateObject = new Date(booking.endDate);
  const now = new Date();

  // --- Status Flags ---
  // Defines if the leg is active right now, on today's date
  const isLegStarted = isToday(legDate) && now >= legStartTime && now < legEndTime;
  // Defines if the leg's scheduled end time has passed
  const isLegCompleted = now >= legEndTime;
  // Logic for "Upcoming" status assigned to a variable:
  // A leg is "Upcoming" for the badge if it's not 'isLegStarted' and not 'isLegCompleted'.
  const isLegUpcoming = !isLegStarted && !isLegCompleted;

  // --- Extended Duration ---
  const extendedDuration = leg.extensions.reduce(
    (acc, { extendedDurationHours }) => acc + extendedDurationHours,
    0,
  );

  const statusBadge = (() => {
    if (booking.status === "CANCELLED") {
      return { text: "Cancelled", styleClass: "bg-red-50 text-red-700 border-red-200" };
    }

    if (isLegStarted) {
      return { text: "Active", styleClass: "bg-blue-50 text-blue-700 border-blue-200" };
    }

    if (isLegCompleted) {
      return { text: "Completed", styleClass: "bg-green-50 text-green-700 border-green-200" };
    }

    if (isLegUpcoming) {
      return { text: "Upcoming", styleClass: "bg-slate-50 text-slate-700 border-slate-200" };
    }

    console.error("BookingLegTimeline: Unreachable status condition for badge determination.");
    return { text: "Error", styleClass: "bg-red-50 text-red-700 border-red-200" };
  })();

  const returnTimeText =
    extendedDuration > 0
      ? `${format(legEndTime, "h:mm a")} (Extended)`
      : format(bookingEndDateObject, "h:mm a");

  return (
    <div key={leg.id} className="space-y-3">
      <div className="flex items-center gap-2">
        <h4
          className={`text-sm font-semibold ${isLegStarted ? "text-slate-700" : "text-slate-400"}`}
        >
          Day {index + 1} - {format(legDate, "EEEE, MMMM do, yyyy")}
        </h4>
        <Badge variant="outline" className={`text-xs rounded-sm ${statusBadge.styleClass}`}>
          {statusBadge.text}
        </Badge>
      </div>

      <div className="flex items-start gap-4">
        <div className="flex flex-col mt-1 items-center">
          <div
            className={`w-3 h-3 rounded-full ${isLegStarted ? "bg-green-500" : "bg-slate-300"}`}
          />
          <div className={`w-px h-8 ${isLegStarted ? "bg-slate-200" : "bg-slate-100"}`} />
          <div className={`w-3 h-3 rounded-full ${isLegStarted ? "bg-red-500" : "bg-slate-300"}`} />
        </div>

        <div className="flex-1 space-y-3">
          <TimePointRow
            label="Pickup"
            timeText={format(legStartTime, "h:mm a")}
            labelColorClassWhenStarted="text-green-600"
            isLegStarted={isLegStarted}
          />
          <TimePointRow
            label="Return"
            timeText={returnTimeText}
            labelColorClassWhenStarted="text-red-600"
            isLegStarted={isLegStarted}
          />
        </div>
      </div>

      {extendedDuration > 0 ? (
        <Alert
          className={`${
            isLegStarted ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-100"
          } rounded-sm`}
        >
          <AlertDescription
            className={`text-sm ${isLegStarted ? "text-amber-800" : "text-slate-600 line-through"}`}
          >
            Your drop-off time
            {isLegStarted ? " has been" : " was"} extended by {extendedDuration}{" "}
            {extendedDuration === 1 ? "hour" : "hours"} from {format(bookingEndDateObject, "p")} to{" "}
            {format(legEndTime, "p")}
          </AlertDescription>
        </Alert>
      ) : (
        <p className={`text-sm ${isLegStarted ? "text-slate-600" : "text-slate-400"}`}>
          Standard 12-hour service
        </p>
      )}
      {index < booking.legs.length - 1 && <Separator />}
    </div>
  );
};

export default function BookingDetails() {
  const { booking, paymentSummary, extendableDuration } = useLoaderData<typeof loader>();
  const [showDropoffFields, setShowDropoffFields] = useState(
    booking.pickupLocation !== booking.returnLocation,
  );
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const actionData = useActionData<typeof action>();
  const [searchParams] = useSearchParams();
  const guestEmail = searchParams.get("email");

  useEffect(() => {
    if (actionData && "success" in actionData && actionData.success) {
      setIsDialogOpen(false);
    }
  }, [actionData]);

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <Link to="/bookings" className="text-sm flex hover:underline">
            &larr; Back to Bookings
          </Link>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* <h1 className="text-lg font-bold text-slate-900">Booking Details</h1> */}
          <p className="text-base font-bold">
            {booking.car.make} {booking.car.model} {booking.car.year} - {booking.car.color}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={`text-sm rounded-sm capitalize ${
                booking.status === "CANCELLED"
                  ? "bg-red-100 text-red-800 border-red-200"
                  : "bg-green-100 text-green-800 border-green-200"
              }`}
            >
              <CheckCircle className="w-3 h-3 mr-1" />
              {booking.status.toLowerCase()}
            </Badge>
            <Badge
              variant="outline"
              className={`text-sm rounded-sm capitalize ${
                booking.paymentStatus === "REFUNDED"
                  ? "bg-blue-100 text-blue-800 border-blue-200"
                  : booking.paymentStatus === "PAID"
                    ? "bg-green-100 text-green-800 border-green-200"
                    : "bg-yellow-100 text-yellow-800 border-yellow-200"
              }`}
            >
              <CreditCard className="w-3 h-3 mr-1" />
              {booking.paymentStatus.toLowerCase()}
            </Badge>
          </div>
        </div>

        <Alert className="border-blue-200 bg-blue-50 rounded">
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
                      <BookingLegTimeline
                        key={leg.id}
                        leg={leg as unknown as BookingLegWithRelations}
                        index={index}
                        booking={booking as unknown as BookingWithRelations}
                      />
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
                  <div className="flex justify-between text-sm">
                    <span className=" text-slate-600">
                      Net Total ({booking.legs.length} {booking.legs.length === 1 ? "day" : "days"})
                    </span>
                    <span className=" font-medium">
                      {formatCurrency(Number(paymentSummary.netTotal))}
                    </span>
                  </div>
                  {Number(paymentSummary.extensionNetTotal) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-600">
                        Extension ({paymentSummary.totalExtendedHours.toString()} hours)
                      </span>
                      <span className="text-sm font-medium">
                        {formatCurrency(Number(paymentSummary.extensionNetTotal))}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-600">
                      Platform Fee ({booking.platformCustomerServiceFeeRatePercent}%)
                    </span>
                    <span className="text-sm font-medium">
                      {formatCurrency(Number(paymentSummary.platformCustomerServiceFeeAmount))}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-600">VAT ({booking.vatRatePercent}%)</span>
                    <span className="text-sm font-medium">
                      {formatCurrency(Number(paymentSummary.vatAmount))}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-bold">
                    <span>Total Amount</span>
                    <span>{formatCurrency(Number(paymentSummary.totalAmount))}</span>
                  </div>
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

                  <Link
                    to={`/bookings/${booking.id}/receipt/pdf/pdfkit`}
                    reloadDocument
                    className="p-2 border rounded text-center flex items-center justify-center w-full"
                  >
                    Download Receipt
                  </Link>

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
