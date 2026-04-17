import { BookingType } from "@prisma/client";
import { addHours, differenceInCalendarDays } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import { AIRPORT_PICKUP_BOOKING_TYPE } from "~/components/bookingTypes";
import { normalizePickupTimeParam } from "~/utils/pickup-time";
import { LAGOS_TIMEZONE } from "~/utils/timezone";

export interface RegularBookingTimeResult {
  startDateTime: Date;
  endDateTime: Date;
}

/**
 * Same default as the car details page and booking action: night bookings
 * default to 11 PM when pickup time is omitted.
 */
export function getEffectivePickupTime(
  bookingType: string,
  pickupTime: string | null,
): string | null {
  if (bookingType === BookingType.NIGHT && !pickupTime) return "11 PM";
  return pickupTime;
}

/**
 * Computes pickup/drop-off instants for non-airport bookings.
 * Must stay in sync with `calculateRegularBookingTimes` in the booking action route.
 */
export function calculateRegularBookingTimes(
  pickupTime: string,
  bookingType: string,
  startDate: string,
  endDate: string,
): { error: string } | RegularBookingTimeResult {
  const canonicalPickup = normalizePickupTimeParam(pickupTime);
  if (!canonicalPickup || !/^(1[0-2]|[1-9])(:00)?\s?(AM|PM)$/i.test(canonicalPickup)) {
    return { error: "Invalid pickup time format" };
  }

  const [timePart, period] = canonicalPickup.split(" ");
  const [hourStr] = timePart.split(":");

  let hour = Number.parseInt(hourStr, 10);

  if (period === "PM" && hour !== 12) {
    hour += 12;
  }

  if (period === "AM" && hour === 12) {
    hour = 0;
  }

  const startHour = bookingType === "NIGHT" ? 23 : hour;
  const startDateTime = fromZonedTime(
    `${startDate}T${String(startHour).padStart(2, "0")}:00:00`,
    LAGOS_TIMEZONE,
  );

  let endDateTime: Date;
  if (bookingType === "NIGHT") {
    endDateTime = fromZonedTime(`${endDate}T05:00:00`, LAGOS_TIMEZONE);
  } else if (bookingType === "FULL_DAY") {
    const daySpan = Math.max(1, differenceInCalendarDays(new Date(endDate), new Date(startDate)));
    endDateTime = addHours(startDateTime, 24 * daySpan);
  } else {
    const dayBookingEndAnchor = fromZonedTime(
      `${endDate}T${String(startHour).padStart(2, "0")}:00:00`,
      LAGOS_TIMEZONE,
    );
    endDateTime = addHours(dayBookingEndAnchor, 12);
  }

  return { startDateTime, endDateTime };
}

function calendarDayFromUrlDateParam(from: string): string {
  if (from.includes("T")) return from.split("T")[0] ?? from;
  return from;
}

/**
 * Instant to use when resolving "is a promotion active?" so loaders match
 * `calculateBookingCost` (which uses booking `startDateTime`).
 *
 * Airport pickup: exact pickup requires flight validation; we use midday Lagos on
 * the trip calendar day so promo windows align with typical same-day rules.
 */
export function resolvePromotionReferenceDate(input: {
  from: string | null;
  to: string | null;
  bookingType: string | null;
  pickupTime: string | null;
  flightNumber?: string | null;
}): Date | null {
  const { from, to, bookingType, pickupTime } = input;
  if (!from || !to || !bookingType) return null;

  if (bookingType === AIRPORT_PICKUP_BOOKING_TYPE) {
    try {
      const day = calendarDayFromUrlDateParam(from);
      const d = fromZonedTime(`${day}T12:00:00`, LAGOS_TIMEZONE);
      if (Number.isNaN(d.getTime())) return null;
      return d;
    } catch {
      return null;
    }
  }

  const effectivePickup = getEffectivePickupTime(bookingType, pickupTime);
  if (!effectivePickup) return null;

  const result = calculateRegularBookingTimes(effectivePickup, bookingType, from, to);
  if ("error" in result) return null;
  return result.startDateTime;
}
