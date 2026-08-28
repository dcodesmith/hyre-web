import { describe, expect, it } from "vitest";

import {
  fleetDashboardEarningsSchema,
  fleetDashboardOverviewSchema,
  fleetPayoutSummarySchema,
  fleetPayoutsSchema,
} from "./schema";

const statusSummary = { count: 0, amountToPay: 0, amountPaid: 0 };

describe("fleet payout API schemas", () => {
  it("parses payout list and summary responses", () => {
    const payouts = fleetPayoutsSchema.parse({
      page: 1,
      limit: 20,
      total: 1,
      items: [
        {
          id: "payout-1",
          amountToPay: 45_000,
          amountPaid: 44_500,
          currency: "NGN",
          status: "PAID_OUT",
          payoutProviderReference: "provider-1",
          initiatedAt: "2026-08-20T10:00:00.000Z",
          processedAt: "2026-08-20T11:00:00.000Z",
          completedAt: "2026-08-20T12:00:00.000Z",
          notes: null,
          bookingId: "booking-1",
          extensionId: null,
        },
      ],
    });
    const summary = fleetPayoutSummarySchema.parse({
      totalPaidOut: 44_500,
      pendingPayouts: 0,
      failedPayouts: 0,
      lastPayoutAt: "2026-08-20T12:00:00.000Z",
      statusBreakdown: {
        PENDING_APPROVAL: statusSummary,
        PENDING_DISBURSEMENT: statusSummary,
        PROCESSING: statusSummary,
        PAID_OUT: { count: 1, amountToPay: 45_000, amountPaid: 44_500 },
        FAILED: statusSummary,
        REVERSED: statusSummary,
      },
    });

    expect(payouts.items[0]?.amountPaid).toBe(44_500);
    expect(summary.statusBreakdown.PAID_OUT.count).toBe(1);
  });

  it("rejects missing status groups", () => {
    expect(
      fleetPayoutSummarySchema.safeParse({
        totalPaidOut: 0,
        pendingPayouts: 0,
        failedPayouts: 0,
        lastPayoutAt: null,
        statusBreakdown: {},
      }).success,
    ).toBe(false);
  });
});

describe("fleet dashboard API schemas", () => {
  it("parses overview and earnings responses", () => {
    const overview = fleetDashboardOverviewSchema.parse({
      totalBookings: 18,
      completedBookings: 12,
      activeBookings: 4,
      cancelledBookings: 2,
      carsCount: 6,
      ownerDriverTrips: 7,
      chauffeurTrips: 5,
      totalEarnings: 920_000,
      pendingPayoutAmount: 80_000,
    });
    const earnings = fleetDashboardEarningsSchema.parse({
      range: {
        from: "2026-07-29T12:00:00.000Z",
        to: "2026-08-28T12:00:00.000Z",
        groupBy: "week",
      },
      totals: {
        gross: 600_000,
        net: 540_000,
        fees: 60_000,
        refunds: 0,
        rides: 8,
      },
      series: [
        {
          bucketStart: "2026-08-24T00:00:00.000Z",
          gross: 150_000,
          net: 135_000,
          fees: 15_000,
          refunds: 0,
          rides: 2,
        },
      ],
    });

    expect(overview.completedBookings).toBe(12);
    expect(earnings.totals.net).toBe(540_000);
  });

  it("rejects unsupported earnings grouping", () => {
    expect(
      fleetDashboardEarningsSchema.safeParse({
        range: {
          from: "2026-07-29T12:00:00.000Z",
          to: "2026-08-28T12:00:00.000Z",
          groupBy: "quarter",
        },
        totals: { gross: 0, net: 0, fees: 0, refunds: 0, rides: 0 },
        series: [],
      }).success,
    ).toBe(false);
  });
});
