import type { BookingDetail } from "~/api/bookings/schema";
import { BookingExtensionPage } from "~/booking/booking-extension";

const fixtureBooking = {
  id: "booking-extend-1",
  bookingReference: "TD-1003",
  status: "CONFIRMED",
  paymentStatus: "PAID",
  type: "DAY",
  startDate: "2026-09-21T08:00:00.000Z",
  endDate: "2026-09-22T20:00:00.000Z",
  pickupLocation: "Murtala Muhammed Airport, Ikeja",
  returnLocation: "12 Marina, Lagos Island",
  totalAmount: 300_000,
  netTotal: 260_870,
  platformCustomerServiceFeeAmount: 18_260,
  platformCustomerServiceFeeRatePercent: 7,
  vatAmount: 20_870,
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
  canEdit: false,
  canCancel: true,
  modificationCutoffAt: "2026-09-20T20:00:00.000Z",
  legs: [
    {
      id: "leg-1",
      legDate: "2026-09-21T00:00:00.000Z",
      legStartTime: "2026-09-21T08:00:00.000Z",
      legEndTime: "2026-09-21T20:00:00.000Z",
      extensions: [],
      canExtend: false,
      maxExtendableHours: 0,
    },
    {
      id: "leg-2",
      legDate: "2026-09-22T00:00:00.000Z",
      legStartTime: "2026-09-22T08:00:00.000Z",
      legEndTime: "2026-09-22T20:00:00.000Z",
      extensions: [],
      canExtend: true,
      maxExtendableHours: 3,
    },
  ],
} satisfies BookingDetail;

export default function BookingExtensionFixture() {
  return (
    <BookingExtensionPage
      booking={fixtureBooking}
      idempotencyKey="00000000-0000-4000-8000-000000000001"
    />
  );
}
