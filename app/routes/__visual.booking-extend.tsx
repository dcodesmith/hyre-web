import { useSearchParams } from "react-router";

import type { BookingDetail } from "~/api/bookings/schema";
import { BookingExtensionPage } from "~/booking/booking-extension";

const fixtureBooking = {
  id: "018f47a2-7b3c-7d4e-8f90-123456789408",
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
  addons: [],
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
      id: "018f47a2-7b3c-7d4e-8f90-123456789421",
      legDate: "2026-09-21T00:00:00.000Z",
      legStartTime: "2026-09-21T08:00:00.000Z",
      legEndTime: "2026-09-21T20:00:00.000Z",
      extensions: [],
      canExtend: false,
      maxExtendableHours: 0,
    },
    {
      id: "018f47a2-7b3c-7d4e-8f90-123456789422",
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
  const [searchParams] = useSearchParams();
  const actionData =
    searchParams.get("error") === "true"
      ? {
          error:
            "This extension is no longer available. Choose a shorter duration, or check the trip dates and try again.",
        }
      : undefined;

  return (
    <BookingExtensionPage
      actionData={actionData}
      booking={fixtureBooking}
      idempotencyKey="00000000-0000-4000-8000-000000000001"
    />
  );
}
