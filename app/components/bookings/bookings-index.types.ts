import type { getBookingsByStatus } from "~/services/bookings.server";

type BookingsMap = NonNullable<Awaited<ReturnType<typeof getBookingsByStatus>>>;

/** Serialized booking row as returned by the bookings index loader. */
export type BookingsListBooking = NonNullable<BookingsMap[keyof BookingsMap]>[number];
