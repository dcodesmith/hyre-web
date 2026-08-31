import { data } from "react-router";

import type { BookingDetail } from "~/api/bookings/schema";
import type { BookingCancelActionData } from "~/booking/booking-cancel";
import { BookingDetailPage } from "~/booking/booking-detail";

const fixtureBooking = {
  id: "booking-cancel-1",
  bookingReference: "TD-1001",
  status: "CONFIRMED",
  paymentStatus: "PAID",
  type: "DAY",
  startDate: "2026-08-21T08:00:00.000Z",
  endDate: "2026-08-21T20:00:00.000Z",
  pickupLocation: "Murtala Muhammed Airport, Ikeja",
  returnLocation: "12 Marina, Lagos Island",
  totalAmount: 150_000,
  netTotal: 130_435,
  platformCustomerServiceFeeAmount: 9_130,
  platformCustomerServiceFeeRatePercent: 7,
  vatAmount: 10_435,
  vatRatePercent: 7.5,
  securityDetailCost: 0,
  fuelUpgradeCost: 0,
  referralDiscountAmount: 0,
  referralCreditsUsed: 0,
  car: {
    make: "Lexus",
    model: "UX F-Sport",
    year: 2019,
  },
  chauffeur: { name: "Bola Adebayo" },
  flight: null,
  canEdit: true,
  canCancel: true,
  modificationCutoffAt: "2026-08-20T20:00:00.000Z",
  legs: [
    {
      id: "leg-1",
      legDate: "2026-08-21T00:00:00.000Z",
      legStartTime: "2026-08-21T08:00:00.000Z",
      legEndTime: "2026-08-21T20:00:00.000Z",
      extensions: [],
      canExtend: false,
      maxExtendableHours: 0,
    },
  ],
} satisfies BookingDetail;

export function action() {
  return data<BookingCancelActionData>({ ok: true });
}

export default function BookingCancelFixture() {
  return (
    <BookingDetailPage
      booking={fixtureBooking}
      reviewAvailability="hidden"
      now="2026-08-01T12:00:00.000Z"
    />
  );
}
