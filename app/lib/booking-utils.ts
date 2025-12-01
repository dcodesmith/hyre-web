import {
  differenceInCalendarDays,
  differenceInDays,
  differenceInHours,
  differenceInMinutes,
  isAfter,
} from "date-fns";
import { toZonedTime } from "date-fns-tz";
import type { BookingWithRelations } from "~/types";
import { LAGOS_TIMEZONE } from "~/utils/timezone";

/**
 * Booking type as string literals to avoid Prisma client-side hydration issues.
 * This matches the Prisma BookingType enum values but works on both client and server.
 */
export type BookingTypeValue = "DAY" | "NIGHT" | "FULL_DAY";

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
