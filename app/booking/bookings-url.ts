import { ordinalDay, SERVICE_TIMEZONE } from "~/time/timezone";

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

const bookingDateTimeFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: SERVICE_TIMEZONE,
  month: "long",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

/** hireApp `format(toZonedTime(date, Africa/Lagos), "PPPp")`. */
export function formatBookingListDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const parts = Object.fromEntries(
    bookingDateTimeFormat.formatToParts(date).map((part) => [part.type, part.value]),
  );

  return `${parts.month} ${ordinalDay(Number(parts.day))}, ${parts.year} at ${parts.hour}:${parts.minute} ${parts.dayPeriod}`;
}
