import { describe, expect, it } from "vitest";

import { referralSummarySchema } from "./schema";

const summary = {
  referralCode: "ABCD1234",
  shareLink: "https://api.example/auth?ref=ABCD1234",
  programEnabled: true,
  discountAmount: 10_000,
  discount: { type: "FIXED", amount: 10_000 },
  hasUsedDiscount: false,
  referredBy: null,
  signupDate: null,
  stats: {
    totalReferrals: 1,
    totalRewardsGranted: 10_000,
    totalRewardsPending: 0,
    lastReferralAt: "2026-08-20T12:00:00.000Z",
    totalEarned: 10_000,
    totalUsed: 0,
    availableCredits: 10_000,
    maxCreditsPerBooking: 30_000,
  },
  referrals: [],
  rewards: [],
};

describe("referralSummarySchema", () => {
  it("accepts a nullable legacy discountAmount with a fixed offer", () => {
    expect(referralSummarySchema.parse(summary)).toEqual(summary);
    expect(
      referralSummarySchema.parse({ ...summary, discountAmount: null }).discountAmount,
    ).toBeNull();
  });

  it("accepts a percentage offer and a generic null offer", () => {
    expect(
      referralSummarySchema.parse({
        ...summary,
        discountAmount: null,
        discount: { type: "PERCENTAGE", percentage: 10, maxAmount: 20_000 },
      }).discount,
    ).toEqual({ type: "PERCENTAGE", percentage: 10, maxAmount: 20_000 });
    expect(
      referralSummarySchema.parse({
        ...summary,
        discountAmount: null,
        discount: null,
        programEnabled: false,
      }).discount,
    ).toBeNull();
  });

  it("requires the discount contract and rejects malformed offers", () => {
    const { discount: _discount, ...missingDiscount } = summary;
    expect(referralSummarySchema.safeParse(missingDiscount).success).toBe(false);
    expect(
      referralSummarySchema.safeParse({
        ...summary,
        discount: { type: "FIXED", amount: 0 },
      }).success,
    ).toBe(false);
    expect(
      referralSummarySchema.safeParse({
        ...summary,
        discount: { type: "PERCENTAGE", percentage: 101, maxAmount: 20_000 },
      }).success,
    ).toBe(false);
  });
});
