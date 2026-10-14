import { SERVICE_TIMEZONE } from "~/time/timezone";

export const BOOKING_LIST_STATUSES = ["ACTIVE", "CONFIRMED", "COMPLETED", "CANCELLED"] as const;

export type BookingListStatus = (typeof BOOKING_LIST_STATUSES)[number];

const BOOKING_LIST_STATUS_SET = new Set<string>(BOOKING_LIST_STATUSES);

export function parseBookingListStatus(searchParams: URLSearchParams): BookingListStatus {
  const status = searchParams.get("status")?.toUpperCase();

  return status && BOOKING_LIST_STATUS_SET.has(status) ? (status as BookingListStatus) : "ACTIVE";
}

export function bookingListPath(status: BookingListStatus) {
  return `/bookings?status=${status.toLowerCase()}`;
}

export function bookingListStatusLabel(status: BookingListStatus) {
  return `${status.charAt(0)}${status.slice(1).toLowerCase()}`;
}

const bookingListPartsFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: SERVICE_TIMEZONE,
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

function bookingListParts(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const parts = Object.fromEntries(
    bookingListPartsFormat.formatToParts(date).map((part) => [part.type, part.value]),
  );

  return {
    month: parts.month ?? "",
    day: parts.day ?? "",
    year: parts.year ?? "",
    time: `${parts.hour}:${parts.minute} ${parts.dayPeriod}`,
  };
}

/** Short Lagos date range, such as "Oct 9 - 10". */
export function formatBookingListDateRange(startValue: string, endValue: string) {
  const start = bookingListParts(startValue);
  const end = bookingListParts(endValue);

  if (!start || !end) {
    return startValue;
  }

  if (start.year === end.year && start.month === end.month && start.day === end.day) {
    return `${start.month} ${start.day}`;
  }

  if (start.year === end.year && start.month === end.month) {
    return `${start.month} ${start.day} - ${end.day}`;
  }

  if (start.year === end.year) {
    return `${start.month} ${start.day} - ${end.month} ${end.day}`;
  }

  return `${start.month} ${start.day}, ${start.year} - ${end.month} ${end.day}, ${end.year}`;
}

/** Pickup clock time in Lagos, such as "11:00 AM". */
export function formatBookingListTime(value: string) {
  return bookingListParts(value)?.time ?? value;
}
