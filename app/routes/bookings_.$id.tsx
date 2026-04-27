import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import type { Prisma, User as PrismaUser } from "@prisma/client";
import { subDays } from "date-fns";
import { Calendar, CheckCircle, CreditCard, Loader2, MapPin, Plane, User } from "lucide-react";
import { useEffect, useState } from "react";
import {
  type ActionFunctionArgs,
  Link,
  type LoaderFunctionArgs,
  type MetaFunction,
  data,
  useActionData,
  useLoaderData,
  useNavigation,
  useRevalidator,
} from "react-router";
import invariant from "tiny-invariant";
import { AutocompleteAddress } from "~/components/AutocompleteAddress";
import { Form } from "~/components/CSRFForm";
import { BookingLegTimeline } from "~/components/booking/BookingLegTimeline";
import { BookingTimeSelect } from "~/components/booking/BookingTimeSelect";
import {
  AIRPORT_PICKUP_BOOKING_TYPE,
  DAY_BOOKING_TYPE,
  NIGHT_BOOKING_TYPE,
} from "~/components/bookingTypes";
import { ReviewCard } from "~/components/reviews/ReviewCard";
import { ReviewForm } from "~/components/reviews/ReviewForm";
import { ReviewPrompt } from "~/components/reviews/ReviewPrompt";
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
import { createPaymentSummary } from "~/lib/booking-utils";
import logger from "~/lib/logger.server";
import {
  formatCurrency,
  getCustomerDetails,
  getLegExtendableDuration,
  isBookingEditable,
  normaliseBookingDetails,
} from "~/lib/utils";
import { getSessionUser } from "~/modules/auth/auth.server";
import { prisma } from "~/modules/db/db.server";
import { sendEmail } from "~/modules/email/email.server";
import {
  renderFleetOwnerBookingCancellationEmail,
  renderUserBookingCancellationEmail,
} from "~/modules/email/templates/booking-notification";
import { Template, sendMessage } from "~/modules/messaging/messaging.server";
import { emailQueue } from "~/queues/email-throttle.server";
import { cancelBooking, getBooking } from "~/services/bookings.server";
import {
  getGuestBookingLookup,
  guestBookingLookupMatches,
} from "~/services/guest-booking-lookup-session.server";
import { refundPayment } from "~/services/payment.server";
import { BookingLegWithRelations, BookingWithRelations } from "~/types";
import { validateCSRF } from "~/utils/csrf-action.server";
import { env } from "~/utils/server/env.server";

type Booking = ReturnType<typeof useLoaderData<typeof loader>>["booking"];

async function authorizeBookingAccess(
  request: Request,
  currentBooking: BookingWithRelations,
): Promise<{
  isAuthorized: boolean;
  sessionUser: PrismaUser | null;
  errorResponse?: Response;
}> {
  const [sessionUser, guestLookup] = await Promise.all([
    getSessionUser(request),
    getGuestBookingLookup(request),
  ]);

  if (sessionUser) {
    return {
      isAuthorized: currentBooking.userId === sessionUser.id,
      sessionUser,
    };
  }

  if (guestLookup) {
    const isGuestMatch = guestBookingLookupMatches(guestLookup, {
      id: currentBooking.id,
      bookingReference: currentBooking.bookingReference,
      guestUser: currentBooking.guestUser,
    });

    if (isGuestMatch) {
      return { isAuthorized: true, sessionUser: null };
    }

    logger.error("Unauthorized guest access", {
      bookingId: currentBooking.id,
      bookingReference: currentBooking.bookingReference,
      guestEmailAttempt: `${guestLookup.email[0]}***${guestLookup.email.substring(guestLookup.email.indexOf("@"))}`,
      lookedUpBookingReference: guestLookup.bookingReference,
      lookedUpBookingId: guestLookup.bookingId,
    });

    return {
      isAuthorized: false,
      sessionUser: null,
      errorResponse: data(
        { error: "Unauthorized: Invalid guest lookup session for this booking action." },
        { status: 403 },
      ),
    };
  }

  return {
    isAuthorized: false,
    sessionUser: null,
    errorResponse: data({ error: "Unauthorized: Access denied." }, { status: 401 }),
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
        car: { include: { owner: { include: { chauffeurs: true } } } },
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
      logger.info("[Booking Cancellation] Initiating refund for cancelled booking", {
        bookingId: booking.id,
        transactionId: booking.paymentId,
        refundAmount: booking.totalAmount.toNumber(),
        paymentStatus: booking.paymentStatus,
      });

      const callbackurl = `${env.FLUTTERWAVE_WEBHOOK_URL}/api/payments/webhook/flutterwave`;
      const refund = await refundPayment(
        booking.paymentId,
        booking.totalAmount.toNumber(),
        callbackurl,
      );

      if (refund.success && "refundId" in refund && refund.refundId) {
        logger.info("[Booking Cancellation] Refund initiated successfully", {
          bookingId: booking.id,
          transactionId: booking.paymentId,
          refundId: refund.refundId,
          refundAmount: refund.amount,
          refundStatus: refund.status,
        });
      } else {
        const refundError =
          "error" in refund ? refund.error : "message" in refund ? refund.message : "";
        logger.error("[Booking Cancellation] Failed to initiate refund - MANUAL REFUND REQUIRED", {
          bookingId: booking.id,
          transactionId: booking.paymentId,
          refundAmount: booking.totalAmount.toNumber(),
          error: refundError,
        });
      }
    } else {
      logger.info("[Booking Cancellation] No refund required for cancelled booking", {
        bookingId: booking.id,
        hasPaymentId: !!booking.paymentId,
        totalAmount: booking.totalAmount.toNumber(),
        paymentStatus: booking.paymentStatus,
      });
    }

    const bookingDetails = normaliseBookingDetails(booking);
    const { email } = getCustomerDetails(booking);

    // Send notifications (single queue job: SMS in parallel, then emails in parallel)
    await emailQueue.add(async () => {
      const smsTasks: Promise<boolean>[] = [];

      if (bookingDetails.customerPhoneNumber) {
        smsTasks.push(
          sendMessage({
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
          }).then((result) => {
            if (result) {
              logger.info(`Message sent successfully to ${bookingDetails.customerPhoneNumber}`);
            } else {
              logger.error(`Failed to send message to ${bookingDetails.customerPhoneNumber}`);
            }
            return result;
          }),
        );
      }

      if (booking.car.owner.phoneNumber) {
        smsTasks.push(
          sendMessage({
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
          }),
        );
      }

      const [, [customerEmailHtml, fleetOwnerEmailHtml]] = await Promise.all([
        Promise.allSettled(smsTasks),
        Promise.all([
          renderUserBookingCancellationEmail(bookingDetails),
          renderFleetOwnerBookingCancellationEmail(bookingDetails),
        ]),
      ]);

      const results = await Promise.allSettled([
        sendEmail({
          to: email,
          subject: "Booking Cancelled",
          html: customerEmailHtml,
        }),
        sendEmail({
          to: booking.car.owner.email,
          subject: "Booking Cancelled by User",
          html: fleetOwnerEmailHtml,
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
  invariant(params.id, "Booking ID is required");
  const bookingId = params.id;

  const [sessionUserFromLoader, guestLookupMaybe, booking] = await Promise.all([
    getSessionUser(request),
    getGuestBookingLookup(request),
    prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        car: { include: { owner: true } },
        user: true,
        chauffeur: true,
        flight: true, // Include flight data for AIRPORT_PICKUP bookings
        review: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
        },
        legs: {
          orderBy: { legDate: "asc" },
          include: {
            extensions: {
              where: { status: "ACTIVE", paymentStatus: "PAID" },
            },
          },
        },
      },
    }),
  ]);

  const guestLookup = sessionUserFromLoader ? null : guestLookupMaybe;

  if (!booking) {
    throw new Response("Booking not found", { status: 404 });
  }

  if (sessionUserFromLoader) {
    if (booking.userId !== sessionUserFromLoader.id) {
      throw new Response("Unauthorized: Booking does not belong to this user.", { status: 403 });
    }
  } else if (guestLookup) {
    const isGuestMatch = guestBookingLookupMatches(guestLookup, {
      id: booking.id,
      bookingReference: booking.bookingReference,
      guestUser: booking.guestUser,
    });

    if (!isGuestMatch) {
      throw new Response("Unauthorized: Guest lookup does not match this booking.", {
        status: 403,
      });
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

  const domain = env.DOMAIN || "https://tripdly.com";
  const isGuestView = Boolean(guestLookup);

  return data(
    { booking: serializedBooking, paymentSummary, extendableDuration, domain, isGuestView },
    { status: 200 },
  );
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data?.booking) {
    return [
      {
        title: "Booking Not Found - Tripdly",
      },
      {
        name: "description",
        content: "The requested booking could not be found.",
      },
    ];
  }

  const { booking } = data;
  const carName = `${booking.car.make} ${booking.car.model} ${booking.car.year}`;
  const bookingRef = booking.bookingReference;

  return [
    {
      title: `Booking ${bookingRef} - ${carName} | Tripdly`,
    },
    {
      name: "description",
      content: `View booking details for ${carName}. Booking reference: ${bookingRef}. Status: ${booking.status}. Manage your booking, view timeline, and location details.`,
    },
    {
      property: "og:title",
      content: `Booking ${bookingRef} - ${carName} | Tripdly`,
    },
    {
      property: "og:description",
      content: `View booking details for ${carName}. Booking reference: ${bookingRef}.`,
    },
    {
      property: "og:type",
      content: "website",
    },
    {
      property: "og:url",
      content: "https://tripdly.com",
    },
    {
      property: "og:image",
      content: `${data.domain}/og-image.jpg`,
    },
    {
      name: "twitter:image",
      content: `${data.domain}/og-image.jpg`,
    },
  ];
};

function BookingHeader({ booking }: Readonly<{ booking: Booking }>) {
  const getPaymentStatusClass = () => {
    if (booking.paymentStatus === "REFUNDED") return "bg-blue-100 text-blue-800 border-blue-200";
    if (booking.paymentStatus === "PAID") return "bg-green-100 text-green-800 border-green-200";
    return "bg-yellow-100 text-yellow-800 border-yellow-200";
  };

  return (
    <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-3">
      <p className="text-base flex flex-col md:flex-row gap-2 md:items-center">
        <span className="font-semibold">
          {booking.car.make} {booking.car.model} ({booking.car.year})
        </span>
        <span className="text-sm text-gray-600 md:text-gray-900">{booking.bookingReference}</span>
      </p>
      <div className="flex flex-wrap gap-2 md:items-end">
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
  );
}

function BookingTimeline({ booking }: { booking: Booking }) {
  return (
    <Card className="rounded">
      <CardHeader className="p-4">
        <CardTitle className="flex items-center gap-2 text-sm md:text-base">
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
        <CardTitle className="flex items-center gap-2 text-sm md:text-base">
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
        <CardTitle className="flex items-center gap-2 text-sm md:text-base">
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

function FlightInfoCard({ booking }: { booking: Booking }) {
  if (!booking.flight) {
    return null;
  }

  const { flight } = booking;
  const LAGOS_TZ = "Africa/Lagos";

  const formatFlightTime = (date: string | null | undefined) => {
    if (!date) return "TBD";
    return new Date(date).toLocaleTimeString("en-GB", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: LAGOS_TZ,
    });
  };

  const formatFlightDate = (date: string | null | undefined) => {
    if (!date) return "TBD";
    return new Date(date).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: LAGOS_TZ,
    });
  };

  const getStatusBadgeClass = () => {
    switch (flight.status) {
      case "SCHEDULED":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "DEPARTED":
        return "bg-cyan-100 text-cyan-800 border-cyan-200";
      case "EN_ROUTE":
        return "bg-green-100 text-green-800 border-green-200";
      case "LANDED":
        return "bg-slate-100 text-slate-800 border-slate-200";
      case "CANCELLED":
        return "bg-red-100 text-red-800 border-red-200";
      case "DIVERTED":
        return "bg-orange-100 text-orange-800 border-orange-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStatusText = () => {
    return flight.status.toLowerCase().replaceAll("_", " ");
  };

  return (
    <Card className="rounded">
      <CardHeader className="p-4">
        <CardTitle className="flex items-center gap-2 text-sm md:text-base">
          <Plane className="w-5 h-5 text-blue-600" />
          Flight Information
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-bold text-slate-900">{flight.flightNumber}</p>
              <p className="text-sm text-slate-600">{formatFlightDate(flight.flightDate)}</p>
            </div>
            <Badge
              variant="outline"
              className={`text-sm rounded-sm capitalize ${getStatusBadgeClass()}`}
            >
              {getStatusText()}
            </Badge>
          </div>

          <Separator />

          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase">From</p>
              <p className="text-sm font-semibold text-slate-900">
                {flight.originName || flight.originCode}
              </p>
              <p className="text-xs text-slate-600">
                {flight.originCity && `${flight.originCity} • `}
                {flight.originCodeIATA || flight.originCode}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium text-slate-500 uppercase">To</p>
              <p className="text-sm font-semibold text-slate-900">
                {flight.destinationName || flight.destinationCode}
              </p>
              <p className="text-xs text-slate-600">
                {flight.destinationCity && `${flight.destinationCity} • `}
                {flight.destinationCodeIATA || flight.destinationCode}
              </p>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase">Scheduled Arrival</p>
              <p className="text-sm font-semibold text-slate-900">
                {formatFlightTime(flight.scheduledArrival)}
              </p>
            </div>
            {flight.estimatedArrival && (
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase">Estimated Arrival</p>
                <p className="text-sm font-semibold text-slate-900">
                  {formatFlightTime(flight.estimatedArrival)}
                </p>
              </div>
            )}
            {flight.actualArrival && (
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase">Actual Arrival</p>
                <p className="text-sm font-semibold text-slate-900">
                  {formatFlightTime(flight.actualArrival)}
                </p>
              </div>
            )}
          </div>

          {flight.delayMinutes && flight.delayMinutes > 0 && (
            <Alert className="border-orange-200 bg-orange-50 rounded">
              <AlertDescription className="text-sm text-orange-800">
                Delayed by {flight.delayMinutes} minutes
              </AlertDescription>
            </Alert>
          )}

          {flight.aircraftType && (
            <div className="pt-2 border-t">
              <p className="text-xs text-slate-500">
                Aircraft: {flight.aircraftType}
                {flight.registration && ` • ${flight.registration}`}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ReviewSection({ booking, isGuestView }: { booking: Booking; isGuestView: boolean }) {
  const [isEditing, setIsEditing] = useState(false);
  const navigation = useNavigation();
  const revalidator = useRevalidator();
  const isSubmitting = navigation.state === "submitting";

  const review = booking.review;

  // Check if review can be edited (within 7 days of creation)
  const canEditReview = review ? new Date(review.createdAt) >= subDays(new Date(), 7) : false;

  // Refresh page data after successful review submission/edit
  const handleReviewSuccess = () => {
    setIsEditing(false);
    // Revalidate to get the updated review data
    revalidator.revalidate();
  };

  // Don't show review section for guest users (they can't create reviews)
  if (isGuestView) {
    return null;
  }

  // Show edit form if editing
  if (isEditing && review && canEditReview) {
    return (
      <Card className="rounded" id="review">
        <CardContent>
          <ReviewForm
            existingReview={{
              id: review.id,
              overallRating: review.overallRating,
              carRating: review.carRating,
              chauffeurRating: review.chauffeurRating,
              serviceRating: review.serviceRating,
              comment: review.comment,
            }}
            onSuccess={handleReviewSuccess}
            onCancel={() => setIsEditing(false)}
            inModal={false}
          />
        </CardContent>
      </Card>
    );
  }

  // Show existing review
  if (review) {
    return (
      <Card className="rounded" id="review">
        <CardHeader>
          <CardTitle>Your Review</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <ReviewCard
              review={{
                id: review.id,
                overallRating: review.overallRating,
                carRating: review.carRating,
                chauffeurRating: review.chauffeurRating,
                serviceRating: review.serviceRating,
                comment: review.comment,
                createdAt: review.createdAt,
                user: review.user,
              }}
              showDetailedRatings
              variant="nested"
            />
            {canEditReview && (
              <Button
                variant="outline"
                onClick={() => setIsEditing(true)}
                disabled={isSubmitting}
                className="w-full sm:w-auto"
              >
                Edit Review
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show review prompt if no review exists
  return <ReviewPrompt bookingId={booking.id} onReviewSubmitted={handleReviewSuccess} />;
}

export default function BookingDetails() {
  const { booking, paymentSummary, extendableDuration, isGuestView } =
    useLoaderData<typeof loader>();
  const [showDropoffFields, setShowDropoffFields] = useState(
    booking.pickupLocation !== booking.returnLocation,
  );

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  const isCancelling = navigation.state === "submitting" && navigation.formMethod === "DELETE";

  useEffect(() => {
    if (actionData && "success" in actionData && actionData.success) {
      setIsDialogOpen(false);
      setIsCancelDialogOpen(false);
    }
  }, [actionData]);

  const canBeModified =
    booking.status === "CONFIRMED" && isBookingEditable(new Date(booking.startDate));
  const canBeExtended = extendableDuration > 0 && booking.type === DAY_BOOKING_TYPE;
  const isCompleted = booking.status === "COMPLETED";

  const shouldShowActionsCard = canBeModified || canBeExtended || isCompleted;

  const getBookingTypeDescription = () => {
    if (booking.type === DAY_BOOKING_TYPE) {
      return "Each booking day is for a 12-hour duration ending 12 hours after the start time unless extended.";
    }

    if (booking.type === NIGHT_BOOKING_TYPE) {
      return "Each night booking is for a 6-hour duration starting at 11pm.";
    }

    if (booking.type === AIRPORT_PICKUP_BOOKING_TYPE) {
      return "Each airport pickup booking is for a one-way trip from the airport.";
    }

    return "Each full day booking is for a 24-hour duration ending 24 hours after the pickup time.";
  };

  return (
    <div className="min-h-screen p-2 sm:p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-4">
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

        <div className="flex flex-row gap-2">
          <div className="flex items-start gap-2 md:hidden">
            <Link
              to="/bookings"
              className="bg-muted bg-opacity-50 p-2 rounded-full hover:bg-opacity-75 transition-opacity"
              aria-label="Back to Bookings"
            >
              <ArrowLeftIcon className="w-5 h-5 text-black" />
            </Link>
          </div>
          <BookingHeader booking={booking} />
        </div>

        <Alert className="border-blue-200 bg-blue-50 rounded">
          <AlertDescription className="text-sm text-blue-800">
            {getBookingTypeDescription()}
          </AlertDescription>
        </Alert>

        <div className="grid lg:grid-cols-3 gap-4 md:gap-6">
          <div className="lg:col-span-2 space-y-6">
            <BookingTimeline booking={booking} />
            <LocationCard booking={booking} />
            {isCompleted && <ReviewSection booking={booking} isGuestView={isGuestView} />}
          </div>

          <div className="space-y-6">
            <ChauffeurCard booking={booking} />
            {booking.type === AIRPORT_PICKUP_BOOKING_TYPE && <FlightInfoCard booking={booking} />}

            <Card className="rounded">
              <CardHeader className="p-4">
                <CardTitle className="flex items-center gap-2 text-sm md:text-base">
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
                  {Number(booking.referralCreditsReserved) > 0 &&
                    booking.paymentStatus !== "PAID" && (
                      <div className="flex justify-between">
                        <span className="text-sm text-orange-600">
                          Referral Credits (Pending Payment)
                        </span>
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
                      VAT ({paymentSummary.vatRatePercent}%)
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
                        to={`/bookings/${booking.id}/extend`}
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
                                    id="pickupTime"
                                    name="pickupTime"
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
