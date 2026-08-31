import { data } from "react-router";

import type { BookingDetail } from "~/api/bookings/schema";
import { BookingDetailPage } from "~/booking/booking-detail";
import type { BookingModifyActionData } from "~/booking/booking-modify";

const fixtureBooking = {
  id: "booking-modify-1",
  bookingReference: "TD-1002",
  status: "CONFIRMED",
  paymentStatus: "UNPAID",
  type: "DAY",
  startDate: "2026-09-21T08:30:00.000Z",
  endDate: "2026-09-21T20:30:00.000Z",
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
  canCancel: false,
  modificationCutoffAt: "2026-09-20T20:00:00.000Z",
  legs: [
    {
      id: "leg-1",
      legDate: "2026-09-21T00:00:00.000Z",
      legStartTime: "2026-09-21T08:30:00.000Z",
      legEndTime: "2026-09-21T20:30:00.000Z",
      extensions: [],
      canExtend: false,
      maxExtendableHours: 0,
    },
  ],
} satisfies BookingDetail;

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  if (formData.get("pickupTime") !== "10 AM") {
    return data<BookingModifyActionData>(
      { error: "Changed pickup time was not submitted." },
      { status: 400 },
    );
  }

  return data<BookingModifyActionData>({ ok: true });
}

export default function BookingModifyFixture() {
  return (
    <BookingDetailPage
      booking={fixtureBooking}
      canDownloadReceipt
      reviewAvailability="hidden"
      now="2026-08-01T12:00:00.000Z"
    />
  );
}
