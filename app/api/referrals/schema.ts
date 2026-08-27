import { z } from "zod";

const referralDateSchema = z.iso.datetime();
const referralRewardStatusSchema = z.enum(["PENDING", "RELEASED", "REVERSED"]);

export const referralSummarySchema = z.object({
  referralCode: z.string().nullable(),
  shareLink: z.string().nullable(),
  programEnabled: z.boolean(),
  discountAmount: z.number(),
  hasUsedDiscount: z.boolean(),
  referredBy: z.string().nullable(),
  signupDate: referralDateSchema.nullable(),
  stats: z.object({
    totalReferrals: z.number(),
    totalRewardsGranted: z.number(),
    totalRewardsPending: z.number(),
    lastReferralAt: referralDateSchema.nullable(),
    totalEarned: z.number(),
    totalUsed: z.number(),
    availableCredits: z.number(),
    maxCreditsPerBooking: z.number(),
  }),
  referrals: z.array(
    z.object({
      id: z.string(),
      name: z.string().nullable(),
      email: z.email(),
      createdAt: referralDateSchema,
    }),
  ),
  rewards: z.array(
    z.object({
      id: z.string(),
      amount: z.number(),
      status: referralRewardStatusSchema,
      createdAt: referralDateSchema,
      processedAt: referralDateSchema.nullable(),
      refereeName: z.string(),
    }),
  ),
});

export type ReferralSummary = z.output<typeof referralSummarySchema>;
export type ReferralReward = ReferralSummary["rewards"][number];
