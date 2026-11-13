import { useSearchParams } from "react-router";

import { ReferralPage, type ReferralPageSummary } from "~/referral/referral-page";

const referralSummary = {
  referralCode: "ADA2026X",
  programEnabled: true,
  stats: {
    totalReferrals: 23,
    totalRewardsGranted: 120_550.32,
    totalRewardsPending: 6_800,
    totalUsed: 80_000,
    availableCredits: 20_550.32,
  },
  referrals: [
    {
      id: "018f47a2-7b3c-7d4e-8f90-123456789431",
      name: "Grace Hopper",
      email: "grace@example.com",
      createdAt: "2026-08-20T12:00:00.000Z",
    },
    {
      id: "018f47a2-7b3c-7d4e-8f90-123456789432",
      name: null,
      email: "friend@example.com",
      createdAt: "2026-08-12T12:00:00.000Z",
    },
    {
      id: "018f47a2-7b3c-7d4e-8f90-123456789433",
      name: "Ada Lovelace",
      email: "a***@example.com",
      createdAt: "2026-08-10T12:00:00.000Z",
    },
    {
      id: "018f47a2-7b3c-7d4e-8f90-123456789434",
      name: "Katherine Johnson",
      email: "k***@example.com",
      createdAt: "2026-08-08T12:00:00.000Z",
    },
    {
      id: "018f47a2-7b3c-7d4e-8f90-123456789435",
      name: "Margaret Hamilton",
      email: "m***@example.com",
      createdAt: "2026-08-06T12:00:00.000Z",
    },
    {
      id: "018f47a2-7b3c-7d4e-8f90-123456789436",
      name: "Annie Easley",
      email: "a***@example.com",
      createdAt: "2026-08-04T12:00:00.000Z",
    },
  ],
} satisfies ReferralPageSummary;

export default function ReferralsFixture() {
  const [searchParams] = useSearchParams();
  const summary = {
    ...referralSummary,
    programEnabled: searchParams.get("disabled") !== "true",
    referrals: searchParams.get("state") === "empty" ? [] : referralSummary.referrals,
  };

  return <ReferralPage summary={summary} shareLink="https://tripdly.com/r/ADA2026X" />;
}
