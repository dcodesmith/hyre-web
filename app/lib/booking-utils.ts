import { BookingType } from "@prisma/client";
import { differenceInCalendarDays, isAfter, startOfDay } from "date-fns";

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
  bookingType: BookingType = BookingType.DAY,
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
  if (bookingType === BookingType.NIGHT) {
    return Math.max(1, differenceInDays);
  }

  // For FULL_DAY bookings: number of 24-hour periods = difference in calendar days
  // Oct 26 to Oct 27 = 1 full day
  // Oct 26 to Oct 28 = 2 full days
  if (bookingType === BookingType.FULL_DAY) {
    return Math.max(1, differenceInDays);
  }

  // For DAY bookings: include both start and end dates
  // Oct 26 to Oct 26 = 1 day
  // Oct 26 to Oct 27 = 2 days
  if (bookingType === BookingType.DAY) {
    return Math.max(1, differenceInDays + 1);
  }

  // Default fallback
  return 1;
}
