import {
  differenceInCalendarDays,
  differenceInHours,
  differenceInMinutes,
  isAfter,
  isSameDay,
  startOfDay,
} from "date-fns";
import { toZonedTime } from "date-fns-tz";
import type { BookingWithRelations } from "~/types";
import { LAGOS_TIMEZONE } from "~/utils/timezone";

/**
 * Booking type as string literals to avoid Prisma client-side hydration issues.
 * This matches the Prisma BookingType enum values but works on both client and server.
 */
export type BookingTypeValue = "DAY" | "NIGHT" | "FULL_DAY" | "AIRPORT_PICKUP";

/**
 * Payment summary result type
 */
export interface PaymentSummary {
  /** Base booking net total (excludes extensions) */
  readonly netTotal: number;
  readonly platformCustomerServiceFeeAmount: number;
  readonly extensionNetTotal: number;
  readonly totalExtendedHours: number;
  readonly vatAmount: number;
  readonly fuelUpgradeCost: number;
  readonly referralDiscountAmount: number;
  readonly totalAmount: number;
  readonly vatRatePercent: number;
}

/**
 * Converts a value to a number, handling both Decimal and number types
 */
function toNumber(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number") return value || 0;
  if (typeof value === "object" && "toNumber" in value) {
    // Handle Decimal type
    return (value as { toNumber: () => number }).toNumber() || 0;
  }
  return Number(value) || 0;
}

/**
 * Creates a payment summary for a booking, handling extensions and calculating totals.
 * Handles both Decimal (from Prisma) and number (serialized) types.
 *
 * @param booking - The booking with relations
 * @returns Payment summary with all calculated values
 */
export function createPaymentSummary(booking: BookingWithRelations): PaymentSummary {
  // Convert all values to numbers, handling both Decimal and number types
  const baseBookingNetTotal = toNumber(booking.netTotal);
  const baseBookingServiceFee = toNumber(booking.platformCustomerServiceFeeAmount);
  const baseBookingVat = toNumber(booking.vatAmount);
  const fuelUpgradeCost = toNumber(booking.fuelUpgradeCost);
  const referralDiscountAmount = toNumber(booking.referralDiscountAmount);
  const vatRatePercent = toNumber(booking.vatRatePercent);

  const extensionSummary = booking.legs
    .flatMap((leg) => leg.extensions)
    .reduce(
      (acc, ext) => {
        acc.netTotal += toNumber(ext.netTotal);
        acc.totalHours += ext.extendedDurationHours ?? 0;
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
      fuelUpgradeCost: fuelUpgradeCost,
      referralDiscountAmount: referralDiscountAmount,
      totalAmount: toNumber(booking.totalAmount),
      vatRatePercent: vatRatePercent,
    };
  }

  // Convert percentage rates to decimals (e.g., 7.5% -> 0.075)
  const feeRatePercent = toNumber(booking.platformCustomerServiceFeeRatePercent) / 100;
  const vatRatePercentDecimal = vatRatePercent / 100;

  const extensionServiceFee = extensionSummary.netTotal * feeRatePercent;
  const extensionSubtotalBeforeVat = extensionSummary.netTotal + extensionServiceFee;
  const extensionVat = extensionSubtotalBeforeVat * vatRatePercentDecimal;

  const finalServiceFee = baseBookingServiceFee + extensionServiceFee;
  const finalVat = baseBookingVat + extensionVat;
  const finalNetTotal = baseBookingNetTotal + extensionSummary.netTotal;
  // const finalGrossTotal = finalNetTotal + finalServiceFee + finalVat;
  const finalGrossTotal =
    finalNetTotal + finalServiceFee + finalVat + fuelUpgradeCost - referralDiscountAmount;

  return {
    netTotal: baseBookingNetTotal,
    platformCustomerServiceFeeAmount: finalServiceFee,
    extensionNetTotal: extensionSummary.netTotal,
    totalExtendedHours: extensionSummary.totalHours,
    vatAmount: finalVat,
    fuelUpgradeCost: fuelUpgradeCost,
    referralDiscountAmount: referralDiscountAmount,
    totalAmount: finalGrossTotal,
    vatRatePercent: vatRatePercent,
  };
}

/**
 * Calculates the number of booking units (days/nights) for a given date range and booking type.
 *
 * @param from - Start date (Date or string)
 * @param to - End date (Date or string)
 * @param bookingType - Type of booking (DAY, NIGHT, or FULL_DAY)
 * @returns Number of booking units (minimum 1)
 */
export function calculateBookingUnits(
  from: Date | string | undefined | null,
  to: Date | string | undefined | null,
  bookingType?: BookingTypeValue | string,
): number {
  if (!from || !to) {
    return 1;
  }

  // Convert strings to Date objects if needed
  const fromDate = typeof from === "string" ? new Date(from) : from;
  const toDate = typeof to === "string" ? new Date(to) : to;

  // Validate dates to prevent NaN propagation from date-fns
  if (!fromDate || !toDate || Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    return 1;
  }

  // Validate that from is not after to
  if (isAfter(fromDate, toDate)) {
    return 1;
  }

  const differenceInDays = differenceInCalendarDays(toDate, fromDate);

  // For NIGHT bookings: number of nights = difference in calendar days
  // Oct 26 to Oct 27 = 1 night
  // Oct 26 to Oct 28 = 2 nights
  if (bookingType === "NIGHT") {
    return Math.max(1, differenceInDays);
  }

  // For FULL_DAY bookings: number of 24-hour periods = difference in calendar days
  // Oct 26 to Oct 27 = 1 full day
  // Oct 26 to Oct 28 = 2 full days
  if (bookingType === "FULL_DAY") {
    return Math.max(1, differenceInDays);
  }

  // For DAY bookings: include both start and end dates
  // Oct 26 to Oct 26 = 1 day
  // Oct 26 to Oct 27 = 2 days
  if (bookingType === "DAY") {
    return Math.max(1, differenceInDays + 1);
  }

  // For AIRPORT_PICKUP bookings: always 1 unit (one-way trip)
  if (bookingType === "AIRPORT_PICKUP") {
    return 1;
  }

  // Default fallback (assume DAY booking)
  return 1;
}

/**
 * Calculates the time remaining until a booking starts, formatted as a human-readable string.
 * Uses Lagos timezone for consistent time calculations.
 *
 * @param booking - The booking with a startDate
 * @returns Formatted time string (e.g., "2d 5h", "3h 30min", "45min") or null if booking has already started
 */
export function getTimeUntilBooking(booking: BookingWithRelations): string | null {
  const now = toZonedTime(new Date(), LAGOS_TIMEZONE);
  const startDate = toZonedTime(new Date(booking.startDate), LAGOS_TIMEZONE);

  if (startDate <= now) {
    return null;
  }

  const totalMinutes = differenceInMinutes(startDate, now);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}min`;
  }

  return `${minutes}min`;
}

/**
 * Calculates the time remaining for a live booking, considering the current leg and any subsequent legs.
 *
 * For live bookings, this function:
 * - Finds today's leg (the leg that falls on the current day in Lagos timezone)
 * - If today's leg is still active, returns the time remaining until it ends
 * - If today's leg has ended and there's a next leg, returns the time until the next leg starts
 * - If today's leg has ended and there's no next leg, indicates the booking has ended
 *
 * All time calculations are performed in Lagos timezone (Africa/Lagos) for consistency.
 *
 * @param booking - The booking with relations, including legs and extensions
 * @returns An object containing:
 *   - `time`: Formatted time string (e.g., "2h 30min", "45min", or "Ended")
 *   - `isNextLeg`: `true` if the time represents time until the next leg starts, `false` otherwise
 *   - `isEnded`: `true` if the booking has completely ended (no more legs), `false` otherwise
 *
 * Returns `null` if:
 *   - The booking has no legs
 *   - No leg is found for today's date
 *
 * @example
 * // Active leg with 2 hours remaining
 * getTimeRemainingForLiveBooking(booking)
 * // => { time: "2h 0min", isNextLeg: false, isEnded: false }
 *
 * // Today's leg ended, next leg starts in 3 hours
 * getTimeRemainingForLiveBooking(booking)
 * // => { time: "3h 0min", isNextLeg: true, isEnded: false }
 *
 * // All legs completed
 * getTimeRemainingForLiveBooking(booking)
 * // => { time: "Ended", isNextLeg: false, isEnded: true }
 */
export function getTimeRemainingForLiveBooking(
  booking: BookingWithRelations,
): { time: string; isNextLeg: boolean; isEnded: boolean } | null {
  if (!booking.legs || booking.legs.length === 0) {
    return null;
  }

  let time: string;

  const now = toZonedTime(new Date(), LAGOS_TIMEZONE);
  const today = startOfDay(now);

  // Sort legs by start time to ensure correct order
  const sortedLegs = [...booking.legs].sort((a, b) => {
    const aStart = new Date(a.legStartTime).getTime();
    const bStart = new Date(b.legStartTime).getTime();
    return aStart - bStart;
  });

  // Find today's leg
  const todaysLegIndex = sortedLegs.findIndex((leg) => {
    const legDate = toZonedTime(new Date(leg.legDate), LAGOS_TIMEZONE);
    return isSameDay(legDate, today);
  });

  if (todaysLegIndex === -1) {
    return null;
  }

  const todaysLeg = sortedLegs[todaysLegIndex];

  // Get effective end time considering extensions
  const effectiveEndTime = getEffectiveLegEndTime(todaysLeg);
  const endTimeZoned = toZonedTime(effectiveEndTime, LAGOS_TIMEZONE);

  // If today's leg has ended, check for next leg
  if (endTimeZoned <= now) {
    // Check if there's a next leg
    const nextLeg = sortedLegs[todaysLegIndex + 1];
    if (nextLeg) {
      // Calculate time until next leg starts
      const nextLegStartTime = toZonedTime(new Date(nextLeg.legStartTime), LAGOS_TIMEZONE);
      const hours = differenceInHours(nextLegStartTime, now);
      const minutes = differenceInMinutes(nextLegStartTime, now) % 60;

      if (hours < 1) {
        time = `${minutes}min`;
      } else {
        time = `${hours}h ${minutes}min`;
      }
      return { time, isNextLeg: true, isEnded: false };
    }
    // No next leg, booking has ended
    return { time: "Ended", isNextLeg: false, isEnded: true };
  }

  // Today's leg is still active, show time remaining
  const hours = differenceInHours(endTimeZoned, now);
  const minutes = differenceInMinutes(endTimeZoned, now) % 60;

  // let timeStr: string;
  if (hours < 1) {
    time = `${minutes}min`;
  } else {
    time = `${hours}h ${minutes}min`;
  }
  return { time, isNextLeg: false, isEnded: false };
}

/**
 * Calculates the effective end time of a booking leg, taking into account any active extensions.
 *
 * A leg's effective end time is the later of:
 * - The leg's original end time
 * - The latest end time from any active extensions (status: "CONFIRMED" or "ACTIVE")
 *
 * This ensures that if a booking has been extended, the effective end time reflects
 * the extended duration rather than the original end time.
 *
 * @param leg - The booking leg object containing:
 *   - `legEndTime`: The original end time of the leg
 *   - `extensions`: Array of extension objects, each with:
 *     - `status`: Extension status (only "CONFIRMED" or "ACTIVE" are considered)
 *     - `extensionEndTime`: The end time of the extension
 *
 * @returns The effective end time as a Date object. If no active extensions exist or
 *   all extension end times are before the original leg end time, returns the original
 *   leg end time. Otherwise, returns the latest extension end time.
 *
 * @example
 * // Leg ends at 6pm, no extensions
 * getEffectiveLegEndTime({ legEndTime: new Date("2024-01-01T18:00:00Z"), extensions: [] })
 * // => Date("2024-01-01T18:00:00Z")
 *
 * // Leg ends at 6pm, extension until 8pm
 * getEffectiveLegEndTime({
 *   legEndTime: new Date("2024-01-01T18:00:00Z"),
 *   extensions: [{ status: "ACTIVE", extensionEndTime: new Date("2024-01-01T20:00:00Z") }]
 * })
 * // => Date("2024-01-01T20:00:00Z")
 */
export function getEffectiveLegEndTime(leg: {
  legEndTime: Date;
  extensions: Array<{ status: string; extensionEndTime: Date }>;
}): Date {
  let effectiveEndTime = new Date(leg.legEndTime);
  const activeExtensionStatuses = new Set(["CONFIRMED", "ACTIVE"]);

  const activeExtensions = leg.extensions.filter((ext) => activeExtensionStatuses.has(ext.status));

  if (activeExtensions.length > 0) {
    const latestExtensionEndTime = activeExtensions.reduce((latestDate, currentExt) => {
      const currentEndTime = new Date(currentExt.extensionEndTime);
      return new Date(Math.max(currentEndTime.getTime(), latestDate.getTime()));
    }, new Date(0));

    if (latestExtensionEndTime.getTime() > effectiveEndTime.getTime()) {
      effectiveEndTime = latestExtensionEndTime;
    }
  }

  return effectiveEndTime;
}
