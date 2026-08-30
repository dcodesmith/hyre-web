import type { BookingDetail, BookingDetailFlight, BookingDetailLeg } from "~/api/bookings/schema";
import {
  AIRPORT_PICKUP_BOOKING_TYPE,
  type BookingType,
  FULL_DAY_BOOKING_TYPE,
  NIGHT_BOOKING_TYPE,
} from "~/booking/types";
import { ordinalDay, SERVICE_TIMEZONE } from "~/time/timezone";

const BOOKING_TYPE_DESCRIPTION = {
  DAY: "Each booking day is for a 12-hour duration ending 12 hours after the start time unless extended.",
  NIGHT: "Each night booking is for a 6-hour duration starting at 11pm.",
  FULL_DAY:
    "Each full day booking is for a 24-hour duration ending 24 hours after the pickup time.",
  AIRPORT_PICKUP: "Each airport pickup booking is for a one-way trip from the airport.",
} as const satisfies Record<BookingType, string>;

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

function confirmedExtensions(leg: BookingDetailLeg) {
  return leg.extensions.filter(
    (extension) => extension.status === "ACTIVE" && extension.paymentStatus === "PAID",
  );
}

export function createPaymentSummary(booking: BookingDetail) {
  const baseBookingNetTotal = money(booking.netTotal);
  const baseBookingServiceFee = money(booking.platformCustomerServiceFeeAmount);
  const baseBookingVat = money(booking.vatAmount);
  const fuelUpgradeCost = money(booking.fuelUpgradeCost);
  const referralDiscountAmount = money(booking.referralDiscountAmount);
  const vatRatePercent = money(booking.vatRatePercent);

  const extensionSummary = booking.legs.flatMap(confirmedExtensions).reduce(
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

function determineLegStatus(legStartTime: Date, legEndTime: Date, now: Date) {
  const isStarted = now >= legStartTime && now < legEndTime;
  const isCompleted = now >= legEndTime;

  return {
    isStarted,
    isCompleted,
    isUpcoming: !isStarted && !isCompleted,
  };
}

export type BookingLegStatusKind = "cancelled" | "active" | "completed" | "upcoming" | "unknown";

function getLegStatusKind(
  bookingStatus: BookingDetail["status"],
  isStarted: boolean,
  isCompleted: boolean,
  isUpcoming: boolean,
): BookingLegStatusKind {
  if (bookingStatus === "CANCELLED") {
    return "cancelled";
  }

  if (isStarted) {
    return "active";
  }

  if (isCompleted) {
    return "completed";
  }

  if (isUpcoming) {
    return "upcoming";
  }

  return "unknown";
}

const LEG_STATUS_TEXT = {
  cancelled: "Cancelled",
  active: "Active",
  completed: "Completed",
  upcoming: "Upcoming",
  unknown: "Unknown",
} as const satisfies Record<BookingLegStatusKind, string>;

function formatLegClock(bookingType: BookingType, value: string) {
  return bookingType === FULL_DAY_BOOKING_TYPE
    ? formatTimelineTimeWithDay(value)
    : formatTimelineTime(value);
}

function withExtendedLabel(timeText: string, extendedDuration: number) {
  return extendedDuration > 0 ? `${timeText} (Extended)` : timeText;
}

function airportMeta(
  city: string | null | undefined,
  iata: string | null | undefined,
  code: string,
) {
  return `${city ? `${city} • ` : ""}${iata || code}`;
}

function createFlightView(flight: BookingDetailFlight) {
  return {
    flightNumber: flight.flightNumber,
    dateLabel: formatFlightDate(flight.flightDate),
    status: flight.status,
    statusLabel: flight.status.toLowerCase().replaceAll("_", " "),
    originName: flight.originName || flight.originCode,
    originMeta: airportMeta(flight.originCity, flight.originCodeIATA, flight.originCode),
    destinationName: flight.destinationName || flight.destinationCode,
    destinationMeta: airportMeta(
      flight.destinationCity,
      flight.destinationCodeIATA,
      flight.destinationCode,
    ),
    scheduledArrivalLabel: formatFlightTime(flight.scheduledArrival),
    estimatedArrivalLabel: flight.estimatedArrival
      ? formatFlightTime(flight.estimatedArrival)
      : null,
    actualArrivalLabel: flight.actualArrival ? formatFlightTime(flight.actualArrival) : null,
    delayMinutes:
      flight.delayMinutes != null && flight.delayMinutes > 0 ? flight.delayMinutes : null,
    aircraftType: flight.aircraftType ?? null,
    registration: flight.registration ?? null,
  };
}

function createLegView(booking: BookingDetail, leg: BookingDetailLeg, index: number, now: Date) {
  const { isStarted, isCompleted, isUpcoming } = determineLegStatus(
    new Date(leg.legStartTime),
    new Date(leg.legEndTime),
    now,
  );
  const extendedDuration = confirmedExtensions(leg).reduce(
    (total, extension) => total + extension.extendedDurationHours,
    0,
  );
  const statusKind = getLegStatusKind(booking.status, isStarted, isCompleted, isUpcoming);

  return {
    id: leg.id,
    title: `Day ${index + 1} - ${formatTimelineDay(leg.legDate)}`,
    isStarted,
    statusKind,
    statusText: LEG_STATUS_TEXT[statusKind],
    pickupTime: formatLegClock(booking.type, leg.legStartTime),
    dropoffTime: withExtendedLabel(formatLegClock(booking.type, leg.legEndTime), extendedDuration),
    showDayExtension: extendedDuration > 0 && booking.type === "DAY",
    extendedDuration,
    extensionFrom: formatTimelineTime(booking.endDate),
    extensionTo: formatTimelineTime(leg.legEndTime),
    serviceTypeText: getServiceTypeText(booking.type),
    showDivider: index < booking.legs.length - 1,
  };
}

/** Booking display facts from the API DTO. Not cancel eligibility or pay authorization. */
export function BookingDomain(booking: BookingDetail, now = new Date()) {
  const payment = createPaymentSummary(booking);
  const dayCount = booking.legs.length;

  return {
    name: `${booking.car.make} ${booking.car.model} (${booking.car.year})`,
    bookingReference: booking.bookingReference,
    status: booking.status,
    statusLabel: booking.status.toLowerCase(),
    isCancelled: booking.status === "CANCELLED",
    paymentStatus: booking.paymentStatus,
    paymentStatusLabel: booking.paymentStatus.toLowerCase(),
    typeDescription: BOOKING_TYPE_DESCRIPTION[booking.type],
    pickupLocation: booking.pickupLocation,
    returnLocation: booking.returnLocation,
    chauffeurName: booking.chauffeur?.name || "Not Assigned",
    chauffeurInitials: chauffeurInitials(booking.chauffeur?.name),
    flight:
      booking.type === AIRPORT_PICKUP_BOOKING_TYPE && booking.flight
        ? createFlightView(booking.flight)
        : null,
    payment: {
      ...payment,
      currency: booking.currency ?? undefined,
      dayCount,
      dayLabel: dayCount === 1 ? "day" : "days",
      securityDetailCost: money(booking.securityDetailCost),
      referralCreditsUsed: money(booking.referralCreditsUsed),
      platformFeePercent: money(booking.platformCustomerServiceFeeRatePercent),
    },
    legs: booking.legs.map((leg, index) => createLegView(booking, leg, index, now)),
  };
}

export type BookingView = ReturnType<typeof BookingDomain>;
export type BookingLegView = BookingView["legs"][number];
export type BookingFlightView = NonNullable<BookingView["flight"]>;
export type BookingPaymentView = BookingView["payment"];
