import { describe, expect, it } from "vitest";

import type { BookingDetail } from "~/api/bookings/schema";

import {
  createPaymentSummary,
  formatTimelineDay,
  formatTimelineTime,
  formatTimelineTimeWithDay,
} from "./booking-detail";

const baseBooking = {
  id: "booking-1",
  bookingReference: "TD-1001",
  status: "COMPLETED",
  paymentStatus: "PAID",
  type: "DAY",
  startDate: "2026-07-02T08:00:00.000Z",
  endDate: "2026-07-02T20:00:00.000Z",
  pickupLocation: "Ikeja",
  returnLocation: "Marina",
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
  car: { make: "Lexus", model: "UX F-Sport", year: 2019 },
  chauffeur: { name: "Bola Adebayo" },
  flight: null,
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

describe("booking detail dates", () => {
  it("matches hireApp timeline copy in Africa/Lagos", () => {
    expect(formatTimelineDay("2026-07-02T00:00:00.000Z")).toBe("Thu, Jul 2nd, 2026");
    expect(formatTimelineTime("2026-07-02T08:00:00.000Z")).toBe("9:00 AM");
    expect(formatTimelineTimeWithDay("2026-07-02T20:00:00.000Z")).toBe("9:00 PM - Jul 2nd");
  });
});

describe("createPaymentSummary", () => {
  it("uses stored totals when there are no extensions", () => {
    expect(createPaymentSummary(baseBooking)).toEqual({
      netTotal: 130_435,
      platformCustomerServiceFeeAmount: 9_130,
      extensionNetTotal: 0,
      totalExtendedHours: 0,
      vatAmount: 10_435,
      fuelUpgradeCost: 0,
      referralDiscountAmount: 0,
      totalAmount: 150_000,
      vatRatePercent: 7.5,
    });
  });

  it("adds extension fee and VAT onto the stored base totals", () => {
    const summary = createPaymentSummary({
      ...baseBooking,
      legs: [
        {
          ...baseBooking.legs[0],
          extensions: [{ extendedDurationHours: 2, netTotal: 20_000 }],
        },
      ],
    });

    expect(summary.extensionNetTotal).toBe(20_000);
    expect(summary.totalExtendedHours).toBe(2);
    expect(summary.platformCustomerServiceFeeAmount).toBe(10_530);
    expect(summary.vatAmount).toBe(12_040);
    expect(summary.totalAmount).toBe(173_005);
  });

  it("folds security and credits into the rebuilt extension total", () => {
    const summary = createPaymentSummary({
      ...baseBooking,
      securityDetailCost: 15_000,
      referralCreditsUsed: 5_000,
      legs: [
        {
          ...baseBooking.legs[0],
          extensions: [{ extendedDurationHours: 2, netTotal: 20_000 }],
        },
      ],
    });

    expect(summary.totalAmount).toBe(183_005);
  });
});
