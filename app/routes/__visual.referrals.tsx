import { useSearchParams } from "react-router";

import { ReferralPage, type ReferralPageSummary } from "~/referral/referral-page";

const referralSummary = {
  referralCode: "ADA2026X",
  programEnabled: true,
  discountAmount: 10_000,
  stats: {
    totalReferrals: 3,
    totalRewardsGranted: 20_000,
    totalRewardsPending: 10_000,
    totalUsed: 5_000,
    availableCredits: 15_000,
  },
  referrals: [
    {
      id: "referral-1",
      name: "Grace Hopper",
      email: "grace@example.com",
      createdAt: "2026-08-20T12:00:00.000Z",
    },
    {
      id: "referral-2",
      name: null,
      email: "friend@example.com",
      createdAt: "2026-08-12T12:00:00.000Z",
    },
  ],
  rewards: [
    {
      id: "reward-1",
      amount: 10_000,
      status: "RELEASED",
      createdAt: "2026-08-22T12:00:00.000Z",
      refereeName: "Grace Hopper",
    },
    {
      id: "reward-2",
      amount: 10_000,
      status: "PENDING",
      createdAt: "2026-08-13T12:00:00.000Z",
      refereeName: "friend@example.com",
    },
  ],
} satisfies ReferralPageSummary;

export default function ReferralsFixture() {
  const [searchParams] = useSearchParams();
  const summary = {
    ...referralSummary,
    programEnabled: searchParams.get("disabled") !== "true",
  };

  return <ReferralPage summary={summary} shareLink="https://tripdly.com/auth?ref=ADA2026X" />;
}
