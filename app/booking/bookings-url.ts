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
