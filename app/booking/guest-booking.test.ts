import { describe, expect, it } from "vitest";

import type { GuestBookingDetail } from "~/api/bookings/schema";
import { BookingDomain } from "~/booking/booking-domain";
import { guestBookingAsDetail } from "~/booking/guest-booking";

const guestBooking = {
  bookingId: "booking-1",
  bookingReference: "BK-123",
  status: "CONFIRMED",
  paymentStatus: "PAID",
  bookingType: "DAY",
  startDate: "2026-09-21T08:00:00.000Z",
  endDate: "2026-09-21T20:00:00.000Z",
  pickupLocation: "Ikeja",
  returnLocation: "Lekki",
  specialRequests: null,
  cancellationReason: null,
  flightNumber: null,
  totalAmount: 50_000,
  currency: "NGN",
  accessExpiresAt: "2026-09-21T12:15:00.000Z",
  car: { make: "Toyota", model: "Camry", year: 2025, images: [] },
  chauffeur: { name: "Bola", phoneNumber: "08000000000" },
  legs: [
    {
      id: "leg-1",
      legDate: "2026-09-21T00:00:00.000Z",
      legStartTime: "2026-09-21T08:00:00.000Z",
      legEndTime: "2026-09-21T20:00:00.000Z",
      extensions: [],
    },
  ],
} satisfies GuestBookingDetail;

describe("guestBookingAsDetail", () => {
  it("reuses the booking view without inventing mutation permissions or fee lines", () => {
    const detail = guestBookingAsDetail(guestBooking);
    const view = BookingDomain(detail);

    expect(detail).toMatchObject({
      id: "booking-1",
      canEdit: false,
      canCancel: false,
      legs: [{ canExtend: false, maxExtendableHours: 0 }],
    });
    expect(view.payment.breakdownAvailable).toBe(false);
    expect(view.payment.totalAmount).toBe(50_000);
  });
});
