import type { BookingDetail } from "~/api/bookings/schema";
import { BookingDetailPage } from "~/booking/booking-detail";

const fixtureBooking = {
  id: "booking-detail-1",
  bookingReference: "TD-1001",
  status: "COMPLETED",
  paymentStatus: "PAID",
  type: "DAY",
  startDate: "2026-07-02T08:00:00.000Z",
  endDate: "2026-07-02T20:00:00.000Z",
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
  canEdit: false,
  canCancel: false,
  modificationCutoffAt: "2026-07-01T20:00:00.000Z",
  legs: [
    {
      id: "leg-1",
      legDate: "2026-07-02T00:00:00.000Z",
      legStartTime: "2026-07-02T08:00:00.000Z",
      legEndTime: "2026-07-02T20:00:00.000Z",
      extensions: [],
    },
  ],
} satisfies BookingDetail;

export default function BookingDetailFixture() {
  return <BookingDetailPage booking={fixtureBooking} now="2026-08-01T12:00:00.000Z" />;
}
