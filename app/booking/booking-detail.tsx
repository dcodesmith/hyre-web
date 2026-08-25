import { ArrowLeft, Calendar, CheckCircle, CreditCard, MapPin, Plane, User } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

import type { BookingDetail, BookingDetailFlight, BookingDetailLeg } from "~/api/bookings/schema";
import { bookingListPath, parseBookingListStatus } from "~/booking/bookings-url";
import {
  AIRPORT_PICKUP_BOOKING_TYPE,
  type BookingType,
  FULL_DAY_BOOKING_TYPE,
  NIGHT_BOOKING_TYPE,
} from "~/booking/types";
import { formatCurrency } from "~/car/car-domain";
import { cn } from "~/lib/utils";
import { ordinalDay, SERVICE_TIMEZONE } from "~/time/timezone";

const BOOKING_TYPE_DESCRIPTION = {
  DAY: "Each booking day is for a 12-hour duration ending 12 hours after the start time unless extended.",
  NIGHT: "Each night booking is for a 6-hour duration starting at 11pm.",
  FULL_DAY:
    "Each full day booking is for a 24-hour duration ending 24 hours after the pickup time.",
  AIRPORT_PICKUP: "Each airport pickup booking is for a one-way trip from the airport.",
} as const satisfies Record<BookingType, string>;

const FLIGHT_STATUS_CLASS = {
  SCHEDULED: "bg-blue-100 text-blue-800 border-blue-200",
  DEPARTED: "bg-cyan-100 text-cyan-800 border-cyan-200",
  EN_ROUTE: "bg-green-100 text-green-800 border-green-200",
  LANDED: "bg-slate-100 text-slate-800 border-slate-200",
  CANCELLED: "bg-red-100 text-red-800 border-red-200",
  DIVERTED: "bg-orange-100 text-orange-800 border-orange-200",
  UNKNOWN: "bg-gray-100 text-gray-800 border-gray-200",
} as const;

const timelineDayFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: SERVICE_TIMEZONE,
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});

const timelineTimeFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: SERVICE_TIMEZONE,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

const timelineMonthDayFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: SERVICE_TIMEZONE,
  month: "short",
  day: "numeric",
});

const flightDateFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: SERVICE_TIMEZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
});

function parseDate(value: string) {
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function withOrdinalDay(parts: Intl.DateTimeFormatPart[]) {
  return parts
    .map((part) => (part.type === "day" ? ordinalDay(Number(part.value)) : part.value))
    .join("");
}

export function formatTimelineDay(value: string) {
  const date = parseDate(value);

  if (!date) {
    return value;
  }

  return withOrdinalDay(timelineDayFormat.formatToParts(date));
}

export function formatTimelineTime(value: string) {
  const date = parseDate(value);

  if (!date) {
    return value;
  }

  return timelineTimeFormat.format(date);
}

export function formatTimelineTimeWithDay(value: string) {
  const date = parseDate(value);

  if (!date) {
    return value;
  }

  return `${formatTimelineTime(value)} - ${withOrdinalDay(timelineMonthDayFormat.formatToParts(date))}`;
}

function formatFlightDate(value: string) {
  const date = parseDate(value);

  return date ? flightDateFormat.format(date) : "TBD";
}

function formatFlightTime(value: string | null | undefined) {
  return value ? formatTimelineTime(value) : "TBD";
}

function money(value: number | null | undefined) {
  return value ?? 0;
}

export function createPaymentSummary(booking: BookingDetail) {
  const baseBookingNetTotal = money(booking.netTotal);
  const baseBookingServiceFee = money(booking.platformCustomerServiceFeeAmount);
  const baseBookingVat = money(booking.vatAmount);
  const fuelUpgradeCost = money(booking.fuelUpgradeCost);
  const referralDiscountAmount = money(booking.referralDiscountAmount);
  const vatRatePercent = money(booking.vatRatePercent);

  const extensionSummary = booking.legs
    .flatMap((leg) => leg.extensions)
    .reduce(
      (acc, extension) => {
        acc.netTotal += money(extension.netTotal);
        acc.totalHours += extension.extendedDurationHours;
        return acc;
      },
      { netTotal: 0, totalHours: 0 },
    );

  if (extensionSummary.totalHours === 0) {
    return {
      netTotal: baseBookingNetTotal,
      platformCustomerServiceFeeAmount: baseBookingServiceFee,
      extensionNetTotal: 0,
      totalExtendedHours: 0,
      vatAmount: baseBookingVat,
      fuelUpgradeCost,
      referralDiscountAmount,
      totalAmount: money(booking.totalAmount),
      vatRatePercent,
    };
  }

  const feeRatePercent = money(booking.platformCustomerServiceFeeRatePercent) / 100;
  const vatRatePercentDecimal = vatRatePercent / 100;
  const extensionServiceFee = extensionSummary.netTotal * feeRatePercent;
  const extensionVat = (extensionSummary.netTotal + extensionServiceFee) * vatRatePercentDecimal;

  return {
    netTotal: baseBookingNetTotal,
    platformCustomerServiceFeeAmount: baseBookingServiceFee + extensionServiceFee,
    extensionNetTotal: extensionSummary.netTotal,
    totalExtendedHours: extensionSummary.totalHours,
    vatAmount: baseBookingVat + extensionVat,
    fuelUpgradeCost,
    referralDiscountAmount,
    totalAmount:
      baseBookingNetTotal +
      extensionSummary.netTotal +
      baseBookingServiceFee +
      extensionServiceFee +
      baseBookingVat +
      extensionVat +
      fuelUpgradeCost +
      money(booking.securityDetailCost) -
      referralDiscountAmount -
      money(booking.referralCreditsUsed),
    vatRatePercent,
  };
}

function chauffeurInitials(name: string | null | undefined) {
  if (!name) {
    return "NA";
  }

  return (
    name
      .split(" ")
      .map((part) => part[0])
      .join("") || "NA"
  );
}

function paymentStatusClass(paymentStatus: BookingDetail["paymentStatus"]) {
  if (paymentStatus === "REFUNDED") {
    return "bg-blue-100 text-blue-800 border-blue-200";
  }

  if (paymentStatus === "PAID") {
    return "bg-green-100 text-green-800 border-green-200";
  }

  return "bg-yellow-100 text-yellow-800 border-yellow-200";
}

function DetailCard({ children }: { readonly children: ReactNode }) {
  return (
    <section className="rounded border bg-card text-card-foreground shadow-sm">{children}</section>
  );
}

function DetailCardHeader({ children }: { readonly children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 p-4 text-sm leading-none font-semibold tracking-tight md:text-base">
      {children}
    </div>
  );
}

function DetailCardBody({ children }: { readonly children: ReactNode }) {
  return <div className="p-4 pt-0">{children}</div>;
}

function OutlineBadge({
  className,
  children,
}: {
  readonly className?: string;
  readonly children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-2.5 py-0.5 text-sm font-semibold capitalize",
        className,
      )}
    >
      {children}
    </span>
  );
}

function BookingHeader({ booking }: { readonly booking: BookingDetail }) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="flex flex-col gap-2 text-base md:flex-row md:items-center">
        <h1 className="text-base font-semibold">
          {booking.car.make} {booking.car.model} ({booking.car.year})
        </h1>
        <span translate="no" className="text-sm text-gray-600 md:text-gray-900">
          {booking.bookingReference}
        </span>
      </div>
      <div className="flex flex-wrap gap-2 md:items-end">
        <OutlineBadge
          className={
            booking.status === "CANCELLED"
              ? "bg-red-100 text-red-800 border-red-200"
              : "bg-green-100 text-green-800 border-green-200"
          }
        >
          <CheckCircle className="mr-1 h-3 w-3" aria-hidden="true" />
          {booking.status.toLowerCase()}
        </OutlineBadge>
        <OutlineBadge className={paymentStatusClass(booking.paymentStatus)}>
          <CreditCard className="mr-1 h-3 w-3" aria-hidden="true" />
          {booking.paymentStatus.toLowerCase()}
        </OutlineBadge>
      </div>
    </div>
  );
}

function TimePointRow({
  label,
  timeText,
  labelColorClassWhenStarted,
  isLegStarted,
}: {
  readonly label: string;
  readonly timeText: string;
  readonly labelColorClassWhenStarted: string;
  readonly isLegStarted: boolean;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <span
          className={cn(
            "min-w-16 text-sm font-medium",
            isLegStarted ? labelColorClassWhenStarted : "text-slate-400",
          )}
        >
          {label}
        </span>
        <span
          className={cn(
            "inline-flex items-center rounded-sm border px-2.5 py-0.5 text-sm font-semibold",
            !isLegStarted && "border-slate-200 text-slate-400",
          )}
        >
          {timeText}
        </span>
      </div>
    </div>
  );
}

function determineLegStatus(legStartTime: Date, legEndTime: Date, now: Date) {
  const isLegStarted = now >= legStartTime && now < legEndTime;
  const isLegCompleted = now >= legEndTime;

  return {
    isLegStarted,
    isLegCompleted,
    isLegUpcoming: !isLegStarted && !isLegCompleted,
  };
}

function TimelineTrack({ isLegStarted }: { readonly isLegStarted: boolean }) {
  return (
    <div className="mt-1 flex flex-col items-center">
      <div className={cn("h-3 w-3 rounded-full", isLegStarted ? "bg-green-500" : "bg-slate-300")} />
      <div className={cn("h-8 w-px", isLegStarted ? "bg-slate-200" : "bg-slate-100")} />
      <div className={cn("h-3 w-3 rounded-full", isLegStarted ? "bg-red-500" : "bg-slate-300")} />
    </div>
  );
}

function DayExtensionNote({
  extendedDuration,
  isLegStarted,
  bookingEndDate,
  legEndTime,
}: {
  readonly extendedDuration: number;
  readonly isLegStarted: boolean;
  readonly bookingEndDate: string;
  readonly legEndTime: string;
}) {
  return (
    <div
      className={cn(
        "rounded-sm border",
        isLegStarted ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-100",
      )}
    >
      <p
        className={cn(
          "p-4 text-sm",
          isLegStarted ? "text-amber-800" : "text-slate-600 line-through",
        )}
      >
        Your drop-off time
        {isLegStarted ? " has been" : " was"} extended by {extendedDuration}{" "}
        {extendedDuration === 1 ? "hour" : "hours"} from {formatTimelineTime(bookingEndDate)} to{" "}
        {formatTimelineTime(legEndTime)}
      </p>
    </div>
  );
}

function getStatusBadge(
  bookingStatus: BookingDetail["status"],
  isLegStarted: boolean,
  isLegCompleted: boolean,
  isLegUpcoming: boolean,
) {
  if (bookingStatus === "CANCELLED") {
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

  return { text: "Unknown", styleClass: "bg-slate-50 text-slate-700 border-slate-200" };
}

function formatLegClock(bookingType: BookingType, value: string) {
  return bookingType === FULL_DAY_BOOKING_TYPE
    ? formatTimelineTimeWithDay(value)
    : formatTimelineTime(value);
}

function withExtendedLabel(timeText: string, extendedDuration: number) {
  return extendedDuration > 0 ? `${timeText} (Extended)` : timeText;
}

function getServiceTypeText(bookingType: BookingType) {
  if (bookingType === FULL_DAY_BOOKING_TYPE) {
    return "Standard 24-hour service";
  }

  if (bookingType === NIGHT_BOOKING_TYPE) {
    return "Standard 6-hour service";
  }

  if (bookingType === AIRPORT_PICKUP_BOOKING_TYPE) {
    return "Airport pickup service";
  }

  return "Standard 12-hour service";
}

function BookingLegTimeline({
  booking,
  leg,
  index,
  now,
}: {
  readonly booking: BookingDetail;
  readonly leg: BookingDetailLeg;
  readonly index: number;
  readonly now: Date;
}) {
  const { isLegStarted, isLegCompleted, isLegUpcoming } = determineLegStatus(
    new Date(leg.legStartTime),
    new Date(leg.legEndTime),
    now,
  );
  const extendedDuration = leg.extensions.reduce(
    (total, extension) => total + extension.extendedDurationHours,
    0,
  );
  const statusBadge = getStatusBadge(booking.status, isLegStarted, isLegCompleted, isLegUpcoming);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h4
          className={cn(
            "text-sm font-semibold",
            isLegStarted ? "text-slate-700" : "text-slate-400",
          )}
        >
          Day {index + 1} - {formatTimelineDay(leg.legDate)}
        </h4>
        <span
          className={cn(
            "inline-flex items-center rounded-sm border px-2.5 py-0.5 text-xs font-semibold",
            statusBadge.styleClass,
          )}
        >
          {statusBadge.text}
        </span>
      </div>

      <div className="flex items-start gap-4">
        <TimelineTrack isLegStarted={isLegStarted} />
        <div className="flex-1 space-y-3">
          <TimePointRow
            label="Pickup"
            timeText={formatLegClock(booking.type, leg.legStartTime)}
            labelColorClassWhenStarted="text-green-600"
            isLegStarted={isLegStarted}
          />
          <TimePointRow
            label="Drop-off"
            timeText={withExtendedLabel(
              formatLegClock(booking.type, leg.legEndTime),
              extendedDuration,
            )}
            labelColorClassWhenStarted="text-red-600"
            isLegStarted={isLegStarted}
          />
        </div>
      </div>

      {extendedDuration > 0 && booking.type === "DAY" ? (
        <DayExtensionNote
          extendedDuration={extendedDuration}
          isLegStarted={isLegStarted}
          bookingEndDate={booking.endDate}
          legEndTime={leg.legEndTime}
        />
      ) : (
        <p className={cn("text-sm", isLegStarted ? "text-slate-600" : "text-slate-400")}>
          {getServiceTypeText(booking.type)}
        </p>
      )}
      {index < booking.legs.length - 1 ? <hr className="h-px w-full border-0 bg-border" /> : null}
    </div>
  );
}

function LocationCard({ booking }: { readonly booking: BookingDetail }) {
  return (
    <DetailCard>
      <DetailCardHeader>
        <MapPin className="h-5 w-5 text-blue-600" aria-hidden="true" />
        Location Details
      </DetailCardHeader>
      <DetailCardBody>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="mt-2 h-2 w-2 rounded-full bg-green-500" />
            <div>
              <p className="text-sm font-medium text-slate-600">Pickup Location</p>
              <p className="text-sm font-semibold text-slate-900">{booking.pickupLocation}</p>
            </div>
          </div>
          <hr className="h-px w-full border-0 bg-border" />
          <div className="flex items-start gap-3">
            <div className="mt-2 h-2 w-2 rounded-full bg-red-500" />
            <div>
              <p className="text-sm font-medium text-slate-600">Return Location</p>
              <p className="text-sm font-semibold text-slate-900">{booking.returnLocation}</p>
            </div>
          </div>
        </div>
      </DetailCardBody>
    </DetailCard>
  );
}

function ChauffeurCard({ booking }: { readonly booking: BookingDetail }) {
  const chauffeurName = booking.chauffeur?.name || "Not Assigned";

  return (
    <DetailCard>
      <DetailCardHeader>
        <User className="h-5 w-5 text-blue-600" aria-hidden="true" />
        Your Chauffeur
      </DetailCardHeader>
      <DetailCardBody>
        <div className="flex items-center gap-3">
          <div className="relative flex h-12 w-12 shrink-0 overflow-hidden rounded-full">
            <div className="flex h-full w-full items-center justify-center rounded-full bg-muted">
              {chauffeurInitials(booking.chauffeur?.name)}
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">{chauffeurName}</p>
            <p className="text-sm text-slate-600">Professional Chauffeur</p>
          </div>
        </div>
      </DetailCardBody>
    </DetailCard>
  );
}

function FlightInfoCard({ flight }: { readonly flight: BookingDetailFlight }) {
  return (
    <DetailCard>
      <DetailCardHeader>
        <Plane className="h-5 w-5 text-blue-600" aria-hidden="true" />
        Flight Information
      </DetailCardHeader>
      <DetailCardBody>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-bold text-slate-900">{flight.flightNumber}</p>
              <p className="text-sm text-slate-600">{formatFlightDate(flight.flightDate)}</p>
            </div>
            <OutlineBadge className={FLIGHT_STATUS_CLASS[flight.status]}>
              {flight.status.toLowerCase().replaceAll("_", " ")}
            </OutlineBadge>
          </div>

          <hr className="h-px w-full border-0 bg-border" />

          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase">From</p>
              <p className="text-sm font-semibold text-slate-900">
                {flight.originName || flight.originCode}
              </p>
              <p className="text-xs text-slate-600">
                {flight.originCity ? `${flight.originCity} • ` : null}
                {flight.originCodeIATA || flight.originCode}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase">To</p>
              <p className="text-sm font-semibold text-slate-900">
                {flight.destinationName || flight.destinationCode}
              </p>
              <p className="text-xs text-slate-600">
                {flight.destinationCity ? `${flight.destinationCity} • ` : null}
                {flight.destinationCodeIATA || flight.destinationCode}
              </p>
            </div>
          </div>

          <hr className="h-px w-full border-0 bg-border" />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase">Scheduled Arrival</p>
              <p className="text-sm font-semibold text-slate-900">
                {formatFlightTime(flight.scheduledArrival)}
              </p>
            </div>
            {flight.estimatedArrival ? (
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase">Estimated Arrival</p>
                <p className="text-sm font-semibold text-slate-900">
                  {formatFlightTime(flight.estimatedArrival)}
                </p>
              </div>
            ) : null}
            {flight.actualArrival ? (
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase">Actual Arrival</p>
                <p className="text-sm font-semibold text-slate-900">
                  {formatFlightTime(flight.actualArrival)}
                </p>
              </div>
            ) : null}
          </div>

          {flight.delayMinutes != null && flight.delayMinutes > 0 ? (
            <div className="rounded border border-orange-200 bg-orange-50 p-4">
              <p className="text-sm text-orange-800">Delayed by {flight.delayMinutes} minutes</p>
            </div>
          ) : null}

          {flight.aircraftType ? (
            <div className="border-t pt-2">
              <p className="text-xs text-slate-500">
                Aircraft: {flight.aircraftType}
                {flight.registration ? ` • ${flight.registration}` : null}
              </p>
            </div>
          ) : null}
        </div>
      </DetailCardBody>
    </DetailCard>
  );
}

function PaymentSummaryCard({ booking }: { readonly booking: BookingDetail }) {
  const paymentSummary = createPaymentSummary(booking);
  const dayCount = booking.legs.length;
  const dayLabel = dayCount === 1 ? "day" : "days";

  return (
    <DetailCard>
      <DetailCardHeader>
        <CreditCard className="h-5 w-5 text-blue-600" aria-hidden="true" />
        Payment Summary
      </DetailCardHeader>
      <DetailCardBody>
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">
              Net Total ({dayCount} {dayLabel})
            </span>
            <span className="font-medium">{formatCurrency(paymentSummary.netTotal)}</span>
          </div>
          {paymentSummary.extensionNetTotal > 0 ? (
            <div className="flex justify-between">
              <span className="text-sm text-slate-600">
                Extension ({paymentSummary.totalExtendedHours} hours)
              </span>
              <span className="text-sm font-medium">
                {formatCurrency(paymentSummary.extensionNetTotal)}
              </span>
            </div>
          ) : null}
          {money(booking.securityDetailCost) > 0 ? (
            <div className="flex justify-between">
              <span className="text-sm text-slate-600">
                Security Detail ({dayCount} {dayLabel})
              </span>
              <span className="text-sm font-medium">
                {formatCurrency(money(booking.securityDetailCost))}
              </span>
            </div>
          ) : null}
          {paymentSummary.fuelUpgradeCost > 0 ? (
            <div className="flex justify-between">
              <span className="text-sm text-slate-600">Fuel Upgrade</span>
              <span className="text-sm font-medium">
                {formatCurrency(paymentSummary.fuelUpgradeCost)}
              </span>
            </div>
          ) : null}
          {paymentSummary.referralDiscountAmount > 0 ? (
            <div className="flex justify-between">
              <span className="text-sm text-green-600">Referral Discount</span>
              <span className="text-sm font-medium text-green-600">
                -{formatCurrency(paymentSummary.referralDiscountAmount)}
              </span>
            </div>
          ) : null}
          {money(booking.referralCreditsUsed) > 0 ? (
            <div className="flex justify-between">
              <span className="text-sm text-green-600">Referral Credits Used</span>
              <span className="text-sm font-medium text-green-600">
                -{formatCurrency(money(booking.referralCreditsUsed))}
              </span>
            </div>
          ) : null}
          {paymentSummary.platformCustomerServiceFeeAmount > 0 ? (
            <div className="flex justify-between">
              <span className="text-sm text-slate-600">
                Platform Fee ({money(booking.platformCustomerServiceFeeRatePercent)}%)
              </span>
              <span className="text-sm font-medium">
                {formatCurrency(paymentSummary.platformCustomerServiceFeeAmount)}
              </span>
            </div>
          ) : null}
          <div className="flex justify-between">
            <span className="text-sm text-slate-600">VAT ({paymentSummary.vatRatePercent}%)</span>
            <span className="text-sm font-medium">{formatCurrency(paymentSummary.vatAmount)}</span>
          </div>
          <hr className="h-px w-full border-0 bg-border" />
          <div className="flex justify-between font-bold">
            <span>Total Amount</span>
            <span>{formatCurrency(paymentSummary.totalAmount)}</span>
          </div>
        </div>
      </DetailCardBody>
    </DetailCard>
  );
}

export function BookingDetailPage({
  booking,
  now,
}: {
  readonly booking: BookingDetail;
  readonly now: string;
}) {
  const clock = new Date(now);
  const backTo = bookingListPath(
    parseBookingListStatus(new URLSearchParams({ status: booking.status.toLowerCase() })),
  );

  return (
    <div className="w-full text-base">
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-4 md:py-6">
        <div className="hidden items-center gap-2 md:flex">
          <Link to={backTo} className="flex text-sm hover:underline">
            &larr; Back to Bookings
          </Link>
        </div>

        <div className="flex flex-row gap-2">
          <div className="flex items-start gap-2 md:hidden">
            <Link
              to={backTo}
              className="rounded-full bg-muted/50 p-2 transition-opacity hover:bg-muted/75"
              aria-label="Back to Bookings"
            >
              <ArrowLeft className="h-5 w-5 text-black" aria-hidden="true" />
            </Link>
          </div>
          <BookingHeader booking={booking} />
        </div>

        <div className="relative w-full rounded border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm text-blue-800">{BOOKING_TYPE_DESCRIPTION[booking.type]}</p>
        </div>

        <div className="grid gap-4 md:gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <DetailCard>
              <DetailCardHeader>
                <Calendar className="h-5 w-5 text-blue-600" aria-hidden="true" />
                Trip Timeline
              </DetailCardHeader>
              <DetailCardBody>
                <div className="space-y-6">
                  {booking.legs.map((leg, index) => (
                    <BookingLegTimeline
                      key={leg.id}
                      booking={booking}
                      leg={leg}
                      index={index}
                      now={clock}
                    />
                  ))}
                </div>
              </DetailCardBody>
            </DetailCard>
            <LocationCard booking={booking} />
          </div>

          <div className="space-y-6">
            <ChauffeurCard booking={booking} />
            {booking.type === AIRPORT_PICKUP_BOOKING_TYPE && booking.flight ? (
              <FlightInfoCard flight={booking.flight} />
            ) : null}
            <PaymentSummaryCard booking={booking} />
          </div>
        </div>
      </div>
    </div>
  );
}
