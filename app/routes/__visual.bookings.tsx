import { useSearchParams } from "react-router";

import type { BookingsByStatus } from "~/api/bookings/schema";
import { BookingsList } from "~/booking/bookings-list";
import { parseBookingListStatus } from "~/booking/bookings-url";

const fixtureBookings = {
  CONFIRMED: [
    {
      id: "booking-confirmed-1",
      bookingReference: "TD-1001",
      status: "CONFIRMED",
      startDate: "2026-08-21T08:00:00.000Z",
      endDate: "2026-08-21T20:00:00.000Z",
      totalAmount: 150_000,
      car: {
        make: "Lexus",
        model: "UX F-Sport",
        year: 2019,
        images: [{ url: "/images/hero-640.webp" }],
      },
      reviewed: false,
    },
  ],
  COMPLETED: [
    {
      id: "booking-completed-1",
      bookingReference: "TD-0882",
      status: "COMPLETED",
      startDate: "2026-07-02T08:00:00.000Z",
      endDate: "2026-07-02T20:00:00.000Z",
      totalAmount: 95_000,
      car: {
        make: "Toyota",
        model: "Camry",
        year: 2023,
        images: [{ url: "/images/hero-1200.webp" }],
      },
      reviewed: true,
    },
    {
      id: "booking-completed-2",
      bookingReference: "TD-0883",
      status: "COMPLETED",
      startDate: "2026-07-10T23:00:00.000Z",
      endDate: "2026-07-11T04:00:00.000Z",
      totalAmount: 80_000,
      car: {
        make: "Honda",
        model: "Accord",
        year: 2024,
        images: [],
      },
      reviewed: false,
    },
  ],
} satisfies BookingsByStatus;

export default function BookingsFixture() {
  const [searchParams] = useSearchParams();
  const status = searchParams.has("status") ? parseBookingListStatus(searchParams) : "COMPLETED";

  return <BookingsList bookings={fixtureBookings} status={status} />;
}
