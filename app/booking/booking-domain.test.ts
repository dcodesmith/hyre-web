import { describe, expect, it } from "vitest";

import type { BookingDetail } from "~/api/bookings/schema";

import {
  BookingDomain,
  createPaymentSummary,
  formatTimelineDay,
  formatTimelineTime,
  formatTimelineTimeWithDay,
} from "./booking-domain";

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
      canExtend: false,
      maxExtendableHours: 0,
    },
  ],
} satisfies BookingDetail;

const confirmedExtension = {
  id: "extension-1",
  status: "ACTIVE",
  paymentStatus: "PAID" as const,
  extendedDurationHours: 2,
  netTotal: 20_000,
};

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
          extensions: [confirmedExtension],
        },
      ],
    });

    expect(summary.extensionNetTotal).toBe(20_000);
    expect(summary.totalExtendedHours).toBe(2);
    expect(summary.platformCustomerServiceFeeAmount).toBe(10_530);
    expect(summary.vatAmount).toBe(12_040);
    expect(summary.totalAmount).toBe(173_005);
  });

  it("does not display an unpaid pending extension as confirmed", () => {
    const summary = createPaymentSummary({
      ...baseBooking,
      legs: [
        {
          ...baseBooking.legs[0],
          extensions: [
            {
              ...confirmedExtension,
              status: "PENDING",
              paymentStatus: "UNPAID",
            },
          ],
        },
      ],
    });

    expect(summary.extensionNetTotal).toBe(0);
    expect(summary.totalExtendedHours).toBe(0);
    expect(summary.totalAmount).toBe(baseBooking.totalAmount);
  });

  it("folds security and credits into the rebuilt extension total", () => {
    const summary = createPaymentSummary({
      ...baseBooking,
      securityDetailCost: 15_000,
      referralCreditsUsed: 5_000,
      legs: [
        {
          ...baseBooking.legs[0],
          extensions: [confirmedExtension],
        },
      ],
    });

    expect(summary.totalAmount).toBe(183_005);
  });
});

describe("BookingDomain", () => {
  const now = new Date("2026-07-02T12:00:00.000Z");

  it("assembles name, chauffeur, and type copy from the booking DTO", () => {
    const booking = BookingDomain(baseBooking, now);

    expect(booking.name).toBe("Lexus UX F-Sport (2019)");
    expect(booking.bookingReference).toBe("TD-1001");
    expect(booking.chauffeurName).toBe("Bola Adebayo");
    expect(booking.chauffeurInitials).toBe("BA");
    expect(booking.typeDescription).toContain("12-hour duration");
    expect(booking.flight).toBeNull();
  });

  it("uses fallback chauffeur copy when none is assigned", () => {
    const booking = BookingDomain({ ...baseBooking, chauffeur: null }, now);

    expect(booking.chauffeurName).toBe("Not Assigned");
    expect(booking.chauffeurInitials).toBe("NA");
  });

  it("marks a cancelled booking and its legs as cancelled", () => {
    const booking = BookingDomain({ ...baseBooking, status: "CANCELLED" }, now);

    expect(booking.isCancelled).toBe(true);
    expect(booking.statusLabel).toBe("cancelled");
    expect(booking.legs[0]?.statusKind).toBe("cancelled");
    expect(booking.legs[0]?.statusText).toBe("Cancelled");
  });

  it("derives leg status from the supplied clock", () => {
    expect(
      BookingDomain(baseBooking, new Date("2026-07-02T06:00:00.000Z")).legs[0]?.statusKind,
    ).toBe("upcoming");
    expect(BookingDomain(baseBooking, now).legs[0]?.statusKind).toBe("active");
    expect(
      BookingDomain(baseBooking, new Date("2026-07-03T00:00:00.000Z")).legs[0]?.statusKind,
    ).toBe("completed");
  });

  it("labels an extended day drop-off and keeps the last good payment rollup", () => {
    const booking = BookingDomain(
      {
        ...baseBooking,
        legs: [
          {
            ...baseBooking.legs[0],
            extensions: [confirmedExtension],
          },
        ],
      },
      now,
    );

    expect(booking.legs[0]?.showDayExtension).toBe(true);
    expect(booking.legs[0]?.dropoffTime).toContain("(Extended)");
    expect(booking.payment.extensionNetTotal).toBe(20_000);
    expect(booking.payment.dayLabel).toBe("day");
  });

  it("assembles airport flight labels only for airport pickups", () => {
    const flight = {
      flightNumber: "P4 7201",
      flightDate: "2026-08-21T00:00:00.000Z",
      status: "EN_ROUTE" as const,
      originCode: "ABV",
      originCodeIATA: "ABV",
      originName: "Nnamdi Azikiwe",
      originCity: "Abuja",
      destinationCode: "LOS",
      destinationCodeIATA: "LOS",
      destinationName: "Murtala Muhammed",
      destinationCity: "Lagos",
      scheduledArrival: "2026-08-21T08:00:00.000Z",
      estimatedArrival: null,
      actualArrival: null,
      delayMinutes: 25,
      aircraftType: "B737",
      registration: "5N-ABC",
    };
    const booking = BookingDomain(
      {
        ...baseBooking,
        type: "AIRPORT_PICKUP",
        flight,
      },
      now,
    );

    expect(booking.flight?.flightNumber).toBe("P4 7201");
    expect(booking.flight?.statusLabel).toBe("en route");
    expect(booking.flight?.originMeta).toBe("Abuja • ABV");
    expect(booking.flight?.delayMinutes).toBe(25);
    expect(booking.flight?.scheduledArrivalLabel).toBe("9:00 AM");
    expect(BookingDomain({ ...baseBooking, flight }, now).flight).toBeNull();
  });
});
