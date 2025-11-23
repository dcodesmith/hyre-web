import type { Prisma, User as PrismaUser } from "@prisma/client";
import { type ActionFunctionArgs, type LoaderFunctionArgs, data } from "@remix-run/node";
import {
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
  useSearchParams,
} from "@remix-run/react";
import { Decimal } from "@prisma/client/runtime/library";
import { isSameDay } from "date-fns";
import { format, toZonedTime } from "date-fns-tz";
import { Calendar, CheckCircle, CreditCard, Loader2, MapPin, User } from "lucide-react";
import { useEffect, useState } from "react";
import invariant from "tiny-invariant";
import { AutocompleteAddress } from "~/components/AutocompleteAddress";
import { BookingTimeSelect } from "~/components/booking/BookingTimeSelect";
import { Form } from "~/components/CSRFForm";
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
import { refundPayment } from "~/services/payment.server";
import { BookingLegWithRelations, BookingWithRelations } from "~/types";
import { validateCSRF } from "~/utils/csrf-action.server";
import { env } from "~/utils/server/env.server";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

type Booking = ReturnType<typeof useLoaderData<typeof loader>>["booking"];

async function authorizeBookingAccess(
  request: Request,
  currentBooking: BookingWithRelations,
  bookingId: string,
): Promise<{
  isAuthorized: boolean;
  sessionUser: PrismaUser | null;
  errorResponse?: Response;
}> {
  const url = new URL(request.url);
  const guestEmail = url.searchParams.get("email");

  if (guestEmail) {
    const bookingGuestDetails = currentBooking.guestUser as Prisma.JsonObject | null;
    const bookingGuestEmail = bookingGuestDetails?.email as string | undefined;

    if (bookingGuestEmail && bookingGuestEmail === guestEmail) {
      return { isAuthorized: true, sessionUser: null };
    }

    logger.error("Unauthorized guest access", {
      bookingId: currentBooking.id,
      bookingReference: currentBooking.bookingReference,
      guestEmailAttempt: `${guestEmail[0]}***${guestEmail.substring(guestEmail.indexOf("@"))}`,
    });

    return {
      isAuthorized: false,
      sessionUser: null,
      errorResponse: data(
        { error: "Unauthorized: Invalid guest email for this booking action." },
        { status: 403 },
      ),
    };
  }

  const sessionUser = await requireUser(request, {
    redirectTo: `/auth?redirectTo=/bookings/${bookingId}`,
  });

  return {
    isAuthorized: currentBooking.userId === sessionUser.id,
    sessionUser,
  };
}

async function parsePickupTime(
  pickupTime: string,
  currentBooking: BookingWithRelations,
): Promise<{ startDate?: Date; endDate?: Date; error?: string }> {
  const baseDate = new Date(currentBooking.startDate);
  const [time, period] = pickupTime.split(" ");
  const [hoursStr, minutesStr] = time.split(":");
  const hours = Number.parseInt(hoursStr, 10);
  const minutes = Number.parseInt(minutesStr, 10);

  let hour24 = hours;
  if (period.toUpperCase() === "PM" && hour24 !== 12) {
    hour24 += 12;
  } else if (period.toUpperCase() === "AM" && hour24 === 12) {
    hour24 = 0;
  }

  if (Number.isNaN(hour24) || Number.isNaN(minutes)) {
    return { error: "Invalid pickup time format." };
  }

  baseDate.setHours(hour24, minutes, 0, 0);
  const newStartDate = new Date(baseDate);
  const newEndDate = new Date(newStartDate);

  if (currentBooking.type === "FULL_DAY") {
    newEndDate.setTime(newStartDate.getTime() + 24 * 60 * 60 * 1000);
  } else {
    newEndDate.setHours(newStartDate.getHours() + 12);
  }

  return { startDate: newStartDate, endDate: newEndDate };
}

async function handleBookingUpdate(
  request: Request,
  bookingId: string,
  currentBooking: BookingWithRelations,
) {
  const formData = await request.formData();
  const pickupTime = formData.get("pickupTime")?.toString();
  const pickupAddress = formData.get("pickupAddress")?.toString();
  const sameLocation = formData.get("sameLocation") === "on";
  const dropOffAddressFromForm = formData.get("dropOffAddress")?.toString();

  let newStartDateForPatch: Date | undefined;
  let newEndDateForPatch: Date | undefined;

  if (pickupTime) {
    const timeResult = await parsePickupTime(pickupTime, currentBooking);
    if (timeResult.error) return timeResult.error;
    newStartDateForPatch = timeResult.startDate;
    newEndDateForPatch = timeResult.endDate;
  }

  const dateForEditCheck = newStartDateForPatch || new Date(currentBooking.startDate);
  if (!isBookingEditable(dateForEditCheck)) {
    return data(
      { error: "Bookings cannot be edited within 12 hours of start time." },
      { status: 400 },
    );
  }

  const newPickupLocationForUpdate =
    pickupAddress && pickupAddress !== currentBooking.pickupLocation ? pickupAddress : undefined;
  const finalEffectivePickupLocation = newPickupLocationForUpdate ?? currentBooking.pickupLocation;
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
    return {
      success: true,
      booking: currentBooking,
      message: "No changes detected.",
    };
  }

  try {
    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: updateData,
      include: {
        user: true,
        car: { include: { owner: true } },
        chauffeur: true,
        legs: { include: { extensions: true } },
      },
    });

    const { email } = getCustomerDetails(updatedBooking);
    const { carName } = normaliseBookingDetails(updatedBooking);

    if (email) {
      await emailQueue.add(async () => {
        try {
          await sendEmail({
            to: email,
            subject: "Booking Updated",
            html: `Your booking for ${carName} has been updated.`,
          });
        } catch (err) {
          logger.error("Failed to send booking update email", { bookingId, to: email, err });
        }
      });
    } else {
      logger.warn("No customer email available for booking update notification", { bookingId });
    }

    return { success: true, booking: updatedBooking };
  } catch {
    return data({ error: "Failed to update booking. Please try again." }, { status: 500 });
  }
}

async function handleBookingCancellation(bookingId: string, sessionUser: PrismaUser | null) {
  try {
    const booking = await cancelBooking(
      bookingId,
      sessionUser ? "User requested cancellation" : "Guest requested cancellation",
    );

    if (!booking) {
      return data({ error: "Booking not found or already cancelled" }, { status: 404 });
    }

    if (booking.paymentId && booking.totalAmount.gt(0)) {
      const callbackurl = `${env.FLUTTERWAVE_WEBHOOK_URL}/api/payments/webhook/flutterwave`;
      const refund = await refundPayment(
        booking.paymentId,
        booking.totalAmount.toNumber(),
        callbackurl,
      );

      if (refund.success && refund.refundId) {
        logger.info(`Refund successful for Booking ${booking.id}. Refund ID: ${refund.refundId}.`);
      } else {
        logger.error(
          `Failed to initiate refund for booking ${booking.id}: ${refund.error}. MANUAL REFUND REQUIRED.`,
        );
      }
    }

    const bookingDetails = normaliseBookingDetails(booking);
    const { email } = getCustomerDetails(booking);

    // Send notifications
    await emailQueue.add(async () => {
      if (bookingDetails.customerPhoneNumber) {
        const result = await sendMessage({
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
          to: bookingDetails.customerPhoneNumber,
          templateKey: Template.BookingCancellationClient,
        });

        if (result) {
          logger.info(`Message sent successfully to ${bookingDetails.customerPhoneNumber}`);
        } else {
          logger.error(`Failed to send message to ${bookingDetails.customerPhoneNumber}`);
        }
      }

      if (booking.car.owner.phoneNumber) {
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
          to: booking.car.owner.phoneNumber,
          templateKey: Template.BookingCancellationFleetOwner,
        });
      }
    });

    await emailQueue.add(async () => {
      const results = await Promise.allSettled([
        sendEmail({
          to: email,
          subject: "Booking Cancelled",
          html: await renderUserBookingCancellationEmail(bookingDetails),
        }),
        sendEmail({
          to: booking.car.owner.email,
          subject: "Booking Cancelled by User",
          html: await renderFleetOwnerBookingCancellationEmail(bookingDetails),
        }),
      ]);

      results.forEach((result, index) => {
        const emailType = index === 0 ? "customer" : "fleet owner";
        if (result.status === "fulfilled") {
          logger.info(`${emailType} email sent successfully`);
        } else {
          logger.error(`${emailType} email failed`, { error: result.reason });
        }
      });
    });

    await emailQueue.onIdle();
    return { success: true, message: "Booking cancelled successfully." };
  } catch {
    return data({ error: "Failed to cancel booking. Please try again." }, { status: 500 });
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  await validateCSRF(request);
  invariant(params.id, "Booking ID is required");

  const currentBooking = await getBooking(params.id);
  if (!currentBooking) {
    return data({ error: "Booking not found" }, { status: 404 });
  }

  const { isAuthorized, sessionUser, errorResponse } = await authorizeBookingAccess(
    request,
    currentBooking,
    params.id,
  );
  if (!isAuthorized) {
    return errorResponse || data({ error: "Unauthorized" }, { status: 403 });
  }

  if (request.method === "PATCH") {
    return handleBookingUpdate(request, params.id, currentBooking);
  }

  if (request.method === "DELETE") {
    return handleBookingCancellation(params.id, sessionUser);
  }

  return data({ error: "Method not allowed" }, { status: 405 });
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

  logger.info({
    msg: "booking loaded",
    bookingId: booking.id,
    bookingReference: booking.bookingReference,
  });

  const paymentSummary = createPaymentSummary(booking);
  const extendableDuration = getLegExtendableDuration(booking);

  // Serialize Decimal fields to numbers to prevent hydration issues
  const serializedBooking = {
    ...booking,
    vatRatePercent: booking.vatRatePercent?.toNumber() ?? 0,
    platformCustomerServiceFeeRatePercent:
      booking.platformCustomerServiceFeeRatePercent?.toNumber() ?? 0,
    securityDetailCost: booking.securityDetailCost?.toNumber() ?? 0,
    referralCreditsUsed: booking.referralCreditsUsed?.toNumber() ?? 0,
    referralCreditsReserved: booking.referralCreditsReserved?.toNumber() ?? 0,
  };

  return data({ booking: serializedBooking, paymentSummary, extendableDuration }, { status: 200 });
}

function createPaymentSummary(booking: BookingWithRelations) {
  // Use schema field names for clarity; map them from your original `netTotal` if different.
  // Example: const baseBookingNetTotal = new Decimal(booking.netTotal ?? 0);
  const baseBookingNetTotal = new Decimal(booking.netTotal ?? 0);
  const baseBookingServiceFee = new Decimal(booking.platformCustomerServiceFeeAmount ?? 0);
  const baseBookingVat = new Decimal(booking.vatAmount ?? 0);
  const fuelUpgradeCost = new Decimal(booking.fuelUpgradeCost ?? 0);
  const referralDiscountAmount = new Decimal(booking.referralDiscountAmount ?? 0);

  // Step 1: Sum up the net total and duration from all active extensions.
  // Using flatMap + reduce is more direct than nested reduce calls.
  const extensionSummary = booking.legs
    .flatMap((leg) => leg.extensions) // Get all extensions into a single array
    // .filter(ext => ext.status !== 'CANCELLED') // Optional: Exclude cancelled extensions
    .reduce(
      (acc, ext) => {
        // Using extension netTotal (sum of confirmed/paid extensions).
        acc.netTotal = acc.netTotal.plus(ext.netTotal ?? 0);
        acc.totalHours += ext.extendedDurationHours ?? 0;
        return acc;
      },
      { netTotal: new Decimal(0), totalHours: 0 },
    );

  // If there are no extensions, return the base booking's summary.
  if (extensionSummary.totalHours === 0) {
    return {
      netTotal: baseBookingNetTotal.toNumber(),
      platformCustomerServiceFeeAmount: baseBookingServiceFee.toNumber(),
      extensionNetTotal: new Decimal(0).toNumber(),
      totalExtendedHours: new Decimal(0).toNumber(),
      vatAmount: baseBookingVat.toNumber(),
      fuelUpgradeCost: fuelUpgradeCost.toNumber(),
      referralDiscountAmount: referralDiscountAmount.toNumber(),
      totalAmount: new Decimal(booking.totalAmount ?? 0).toNumber(),
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
    netTotal: baseBookingNetTotal.toNumber(),
    platformCustomerServiceFeeAmount: finalServiceFee.toNumber(),
    extensionNetTotal: extensionSummary.netTotal.toNumber(),
    totalExtendedHours: new Decimal(extensionSummary.totalHours).toNumber(),
    vatAmount: finalVat.toNumber(),
    fuelUpgradeCost: fuelUpgradeCost.toNumber(),
    referralDiscountAmount: referralDiscountAmount.toNumber(),
    totalAmount: finalGrossTotal.toNumber(),
  };
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
}: {
  leg: BookingLegWithRelations;
  index: number;
  booking: BookingWithRelations;
}) => {
  const LAGOS_TZ = "Africa/Lagos";

  // Convert dates to Lagos timezone for consistent display
  const legDate = toZonedTime(new Date(leg.legDate), LAGOS_TZ);
  const legEndTime = toZonedTime(new Date(leg.legEndTime), LAGOS_TZ);
  const legStartTime = toZonedTime(new Date(leg.legStartTime), LAGOS_TZ);
  const bookingEndDateObject = toZonedTime(new Date(booking.endDate), LAGOS_TZ);
  const now = toZonedTime(new Date(), LAGOS_TZ);

  // --- Status Flags ---
  // Defines if the leg is active right now, on today's date
  const isLegStarted = isSameDay(legDate, now) && now >= legStartTime && now < legEndTime;
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

  const getReturnTimeText = () => {
    if (extendedDuration > 0) {
      return `${format(legEndTime, "h:mm a")} (Extended)`;
    }
    return format(legEndTime, "h:mm a");
  };

  const getFullDayReturnText = () => {
    if (extendedDuration > 0) {
      return `${format(legEndTime, "h:mm a - MMM do")} (Extended)`;
    }
    return format(legEndTime, "h:mm a - MMM do");
  };

  const getServiceTypeText = () => {
    if (booking.type === "FULL_DAY") return "Standard 24-hour service";
    if (booking.type === "NIGHT") return "Standard 6-hour service";
    return "Standard 12-hour service";
  };

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
            timeText={
              booking.type === "FULL_DAY"
                ? format(legStartTime, "h:mm a - MMM do")
                : format(legStartTime, "h:mm a")
            }
            labelColorClassWhenStarted="text-green-600"
            isLegStarted={isLegStarted}
          />
          <TimePointRow
            label="Return"
            timeText={booking.type === "FULL_DAY" ? getFullDayReturnText() : getReturnTimeText()}
            labelColorClassWhenStarted="text-red-600"
            isLegStarted={isLegStarted}
          />
        </div>
      </div>

      {extendedDuration > 0 && booking.type === "DAY" ? (
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
          {getServiceTypeText()}
        </p>
      )}
      {index < booking.legs.length - 1 && <Separator />}
    </div>
  );
};

function BookingHeader({ booking }: { booking: Booking }) {
  const getPaymentStatusClass = () => {
    if (booking.paymentStatus === "REFUNDED") return "bg-blue-100 text-blue-800 border-blue-200";
    if (booking.paymentStatus === "PAID") return "bg-green-100 text-green-800 border-green-200";
    return "bg-yellow-100 text-yellow-800 border-yellow-200";
  };

  return (
    <>
      {/* Mobile layout - stacked */}
      <div className="flex flex-col gap-3 md:hidden">
        <div className="flex flex-col gap-1">
          <span className="text-base font-semibold">
            {booking.car.make} {booking.car.model} - {booking.car.year}
          </span>
          <span className="text-sm text-gray-600">
            Booking Reference: {booking.bookingReference}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
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
            className={`text-sm rounded-sm capitalize ${getPaymentStatusClass()}`}
          >
            <CreditCard className="w-3 h-3 mr-1" />
            {booking.paymentStatus.toLowerCase()}
          </Badge>
        </div>
      </div>

      {/* Desktop layout - horizontal */}
      <div className="hidden md:flex flex-row justify-between items-end gap-3">
        <p className="text-base flex sm:flex-row flex-col gap-2">
          <span className="font-semibold items-end">
            {booking.car.make} {booking.car.model} - {booking.car.year}
          </span>
          <span className="text-sm items-end">Booking Reference: {booking.bookingReference}</span>
        </p>
        <div className="flex flex-wrap items-end gap-2">
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
            className={`text-sm rounded-sm capitalize ${getPaymentStatusClass()}`}
          >
            <CreditCard className="w-3 h-3 mr-1" />
            {booking.paymentStatus.toLowerCase()}
          </Badge>
        </div>
      </div>
    </>
  );
}

function BookingTimeline({ booking }: { booking: Booking }) {
  return (
    <Card className="rounded">
      <CardHeader className="p-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Calendar className="w-5 h-5 text-blue-600" />
          Trip Timeline
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="space-y-6">
          {booking.legs.map((leg, index: number) => (
            <BookingLegTimeline
              key={leg.id}
              leg={leg as unknown as BookingLegWithRelations}
              index={index}
              booking={booking as unknown as BookingWithRelations}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function LocationCard({ booking }: { booking: Booking }) {
  return (
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
              <p className="text-sm font-semibold text-slate-900">{booking.pickupLocation}</p>
            </div>
          </div>
          <Separator />
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 bg-red-500 rounded-full mt-2" />
            <div>
              <p className="text-sm font-medium text-slate-600">Return Location</p>
              <p className="text-sm font-semibold text-slate-900">{booking.returnLocation}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ChauffeurCard({ booking }: { booking: Booking }) {
  return (
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
                    .map((n: string) => n[0])
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
  );
}

export default function BookingDetails() {
  const { booking, paymentSummary, extendableDuration } = useLoaderData<typeof loader>();
  const [showDropoffFields, setShowDropoffFields] = useState(
    booking.pickupLocation !== booking.returnLocation,
  );

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();
  const guestEmail = searchParams.get("email");

  const isCancelling = navigation.state === "submitting" && navigation.formMethod === "DELETE";

  useEffect(() => {
    if (actionData && "success" in actionData && actionData.success) {
      setIsDialogOpen(false);
      setIsCancelDialogOpen(false);
    }
  }, [actionData]);

  const canBeModified =
    booking.status === "CONFIRMED" && isBookingEditable(new Date(booking.startDate));
  const canBeExtended = extendableDuration > 0 && booking.type === "DAY";
  const isCompleted = booking.status === "COMPLETED";

  const shouldShowActionsCard = canBeModified || canBeExtended || isCompleted;

  const getBookingTypeDescription = () => {
    if (booking.type === "DAY") {
      return "Each booking day is for a 12-hour duration ending 12 hours after the start time unless extended.";
    }

    if (booking.type === "NIGHT") {
      return "Each night booking is for a 6-hour duration starting at 11pm.";
    }

    return "Each full day booking is for a 24-hour duration ending 24 hours after the pickup time.";
  };

  return (
    <div className="min-h-screen p-2 sm:p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Mobile-only back button with circular icon */}
        <div className="flex items-center gap-2 md:hidden">
          <Link
            to="/bookings"
            className="bg-muted bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-75 transition-opacity"
            aria-label="Back to Bookings"
          >
            <ArrowLeftIcon className="w-5 h-5 text-black" />
          </Link>
        </div>

        {/* Desktop-only back link */}
        <div className="items-center gap-2 hidden md:flex">
          <Link to="/bookings" className="text-sm flex hover:underline">
            &larr; Back to Bookings
          </Link>
        </div>

        {actionData && "error" in actionData && (
          <Alert className="border-red-200 bg-red-50 rounded">
            <AlertDescription className="text-sm text-red-800">{actionData.error}</AlertDescription>
          </Alert>
        )}

        {actionData && "success" in actionData && actionData.success && "message" in actionData && (
          <Alert className="border-green-200 bg-green-50 rounded">
            <AlertDescription className="text-sm text-green-800">
              {actionData.message}
            </AlertDescription>
          </Alert>
        )}

        <BookingHeader booking={booking} />

        <Alert className="border-blue-200 bg-blue-50 rounded">
          <AlertDescription className="text-sm text-blue-800">
            {getBookingTypeDescription()}
          </AlertDescription>
        </Alert>

        <div className="grid lg:grid-cols-3 gap-4 md:gap-6">
          <div className="lg:col-span-2 space-y-6">
            <BookingTimeline booking={booking} />
            <LocationCard booking={booking} />
          </div>

          <div className="space-y-6">
            <ChauffeurCard booking={booking} />

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
                        Extension ({Number(paymentSummary.totalExtendedHours)} hours)
                      </span>
                      <span className="text-sm font-medium">
                        {formatCurrency(Number(paymentSummary.extensionNetTotal))}
                      </span>
                    </div>
                  )}
                  {Number(booking.securityDetailCost ?? 0) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-600">
                        Security Detail ({booking.legs.length}{" "}
                        {booking.legs.length === 1 ? "day" : "days"})
                      </span>
                      <span className="text-sm font-medium">
                        {formatCurrency(Number(booking.securityDetailCost))}
                      </span>
                    </div>
                  )}
                  {Number(paymentSummary.fuelUpgradeCost) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-600">Fuel Upgrade</span>
                      <span className="text-sm font-medium">
                        {formatCurrency(Number(paymentSummary.fuelUpgradeCost))}
                      </span>
                    </div>
                  )}
                  {Number(paymentSummary.referralDiscountAmount) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-sm text-green-600">Referral Discount</span>
                      <span className="text-sm font-medium text-green-600">
                        -{formatCurrency(Number(paymentSummary.referralDiscountAmount))}
                      </span>
                    </div>
                  )}
                  {Number(booking.referralCreditsUsed) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-sm text-green-600">Referral Credits Used</span>
                      <span className="text-sm font-medium text-green-600">
                        -{formatCurrency(Number(booking.referralCreditsUsed))}
                      </span>
                    </div>
                  )}
                  {Number(booking.referralCreditsReserved) > 0 && booking.paymentStatus !== "PAID" && (
                    <div className="flex justify-between">
                      <span className="text-sm text-orange-600">Referral Credits (Pending Payment)</span>
                      <span className="text-sm font-medium text-orange-600">
                        -{formatCurrency(Number(booking.referralCreditsReserved))}
                      </span>
                    </div>
                  )}
                  {Number(paymentSummary.platformCustomerServiceFeeAmount) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-600">
                        Platform Fee ({Number(booking.platformCustomerServiceFeeRatePercent)}%)
                      </span>
                      <span className="text-sm font-medium">
                        {formatCurrency(Number(paymentSummary.platformCustomerServiceFeeAmount))}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-600">
                      VAT ({booking.vatRatePercent.toString()}%)
                    </span>
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

            {shouldShowActionsCard && (
              <Card className="rounded">
                <CardContent className="p-4">
                  <div className="space-y-2">
                    {canBeExtended && (
                      <Link
                        to={`/bookings/${booking.id}/extend${guestEmail ? `?email=${guestEmail}` : ""}`}
                        className="p-2 border rounded text-center flex items-center justify-center w-full"
                      >
                        Extend Booking for up to {extendableDuration}{" "}
                        {extendableDuration === 1 ? "hour" : "hours"}
                      </Link>
                    )}

                    {canBeModified && (
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

                    {isCompleted && (
                      <Link
                        to={`/bookings/${booking.id}/receipt/pdf/pdfkit`}
                        reloadDocument
                        className="p-2 border rounded text-center flex items-center justify-center w-full"
                      >
                        Download Receipt
                      </Link>
                    )}

                    {canBeModified && (
                      <Dialog
                        open={isCancelDialogOpen}
                        onOpenChange={(open) => !isCancelling && setIsCancelDialogOpen(open)}
                      >
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isCancelling}
                            className="text-sm w-full rounded-sm text-red-600 hover:text-red-700"
                          >
                            {isCancelling ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Cancelling...
                              </>
                            ) : (
                              "Cancel Booking"
                            )}
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                          <DialogHeader>
                            <DialogTitle>Cancel Booking</DialogTitle>
                            <DialogDescription>
                              <span className="block">
                                Are you sure you want to cancel this booking? This action cannot be
                                undone.
                              </span>
                              {booking.paymentStatus === "PAID" && (
                                <span className="block">
                                  A refund will be processed automatically.
                                  <br />
                                </span>
                              )}
                            </DialogDescription>
                          </DialogHeader>
                          <Form method="DELETE" className="space-y-4">
                            <div className="flex justify-end gap-3">
                              <Button
                                variant="outline"
                                type="button"
                                disabled={isCancelling}
                                onClick={() => setIsCancelDialogOpen(false)}
                              >
                                Cancel
                              </Button>
                              <Button type="submit" variant="destructive" disabled={isCancelling}>
                                {isCancelling ? (
                                  <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Cancelling...
                                  </>
                                ) : (
                                  "Yes, Cancel Booking"
                                )}
                              </Button>
                            </div>
                          </Form>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
