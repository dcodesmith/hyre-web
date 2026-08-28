import { describe, expect, it } from "vitest";

import { fleetPayoutSummarySchema, fleetPayoutsSchema } from "./schema";

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
