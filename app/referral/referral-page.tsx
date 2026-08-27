import { AlertTriangle, Clipboard, Gift, Share2, Sparkles, Users, Wallet } from "lucide-react";

import type { ReferralSummary } from "~/api/referrals/schema";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { cn } from "~/lib/utils";
import { formatCurrency } from "~/money/currency";

import { shareReferralLink } from "./share-referral-link";
import { useCopyFeedback } from "./use-copy-feedback";

export type ReferralPageSummary = Pick<
  ReferralSummary,
  "referralCode" | "programEnabled" | "discountAmount"
> & {
  readonly stats: Pick<
    ReferralSummary["stats"],
    | "totalReferrals"
    | "totalRewardsGranted"
    | "totalRewardsPending"
    | "totalUsed"
    | "availableCredits"
  >;
  readonly referrals: ReadonlyArray<
    Pick<ReferralSummary["referrals"][number], "id" | "name" | "email" | "createdAt">
  >;
  readonly rewards: ReadonlyArray<
    Pick<
      ReferralSummary["rewards"][number],
      "id" | "amount" | "status" | "createdAt" | "refereeName"
    >
  >;
};

const referralDateFormatter = new Intl.DateTimeFormat("en-NG", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "Africa/Lagos",
});

const cardClassName = "gap-0 rounded border border-neutral-200 py-0 shadow-sm ring-0";
const statIcons = {
  totalReferrals: <Users aria-hidden="true" className="size-4.5 text-blue-500" />,
  rewardsEarned: <Gift aria-hidden="true" className="size-4.5 text-green-500" />,
  pendingRewards: <Sparkles aria-hidden="true" className="size-4.5 text-orange-500" />,
  usedCredits: <Wallet aria-hidden="true" className="size-4.5 text-red-500" />,
  availableCredits: <Wallet aria-hidden="true" className="size-4.5 text-purple-500" />,
} as const;

function formatReferralDate(value: string) {
  return referralDateFormatter.format(new Date(value));
}

function rewardStatusClassName(status: ReferralPageSummary["rewards"][number]["status"]) {
  switch (status) {
    case "RELEASED":
      return "bg-green-100 text-green-700";
    case "PENDING":
      return "bg-orange-100 text-orange-700";
    case "REVERSED":
      return "bg-red-100 text-red-700";
  }
}

function StatCard({
  label,
  value,
  icon,
}: {
  readonly label: string;
  readonly value: string | number;
  readonly icon: React.ReactNode;
}) {
  return (
    <Card className={cardClassName}>
      <CardContent className="p-4">
        <div className="mb-3 flex size-9 items-center justify-center rounded-full bg-neutral-100">
          {icon}
        </div>
        <p className="text-xl font-bold text-neutral-950 tabular-nums">{value}</p>
        <p className="mt-1 text-xs font-medium text-neutral-500">{label}</p>
      </CardContent>
    </Card>
  );
}

function RewardRow({ reward }: { readonly reward: ReferralPageSummary["rewards"][number] }) {
  return (
    <li className="flex items-center justify-between rounded border border-neutral-200 p-3">
      <div className="min-w-0 flex-1 pr-3">
        <p className="text-base font-semibold text-neutral-950 tabular-nums">
          {formatCurrency(reward.amount)}
        </p>
        <p className="mt-0.5 truncate text-sm text-neutral-500">From {reward.refereeName}</p>
      </div>
      <div className="shrink-0 text-right">
        <Badge className={cn("capitalize", rewardStatusClassName(reward.status))}>
          {reward.status.toLowerCase()}
        </Badge>
        <p className="mt-1 text-xs text-neutral-500">{formatReferralDate(reward.createdAt)}</p>
      </div>
    </li>
  );
}

export function ReferralPage({
  summary,
  shareLink,
}: {
  readonly summary: ReferralPageSummary;
  readonly shareLink: string | null;
}) {
  const { copiedTarget, copyError, copyToClipboard } = useCopyFeedback();
  const { referralCode } = summary;

  const stats = [
    {
      label: "Total Referrals",
      value: summary.stats.totalReferrals,
      icon: statIcons.totalReferrals,
    },
    {
      label: "Rewards Earned",
      value: formatCurrency(summary.stats.totalRewardsGranted),
      icon: statIcons.rewardsEarned,
    },
    {
      label: "Pending Rewards",
      value: formatCurrency(summary.stats.totalRewardsPending),
      icon: statIcons.pendingRewards,
    },
    {
      label: "Used Credits",
      value: formatCurrency(summary.stats.totalUsed),
      icon: statIcons.usedCredits,
    },
    {
      label: "Available Credits",
      value: formatCurrency(summary.stats.availableCredits),
      icon: statIcons.availableCredits,
    },
  ];

  const steps = [
    {
      title: "Share your code",
      body: "Send your referral code or link to friends",
    },
    {
      title: "They sign up",
      body: "Friends create an account using your code",
    },
    {
      title: "Both get rewards",
      body: `They get ${formatCurrency(summary.discountAmount)} discount, you earn ${formatCurrency(summary.discountAmount)} reward`,
    },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 pb-24 md:py-8">
      <header>
        <h1 className="text-3xl font-bold text-neutral-950">Referral Program</h1>
        <p className="mt-2 text-base text-neutral-500">
          Invite friends and earn rewards when they book their first trip!
        </p>
      </header>

      {!summary.programEnabled ? (
        <div className="rounded border border-yellow-200 bg-yellow-50 p-4 text-yellow-800">
          <div className="flex items-center gap-2">
            <AlertTriangle aria-hidden="true" className="size-4.5" />
            <p className="font-semibold">Referral Program Temporarily Disabled</p>
          </div>
          <p className="mt-1 text-sm text-yellow-700">
            New referrals cannot be processed at this time.
          </p>
        </div>
      ) : null}

      <Card className={cardClassName}>
        <CardHeader className="border-b border-neutral-100 px-5 py-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-neutral-950">
            <Gift aria-hidden="true" className="size-5" />
            Your Referral Code
          </h2>
        </CardHeader>
        <CardContent className="space-y-4 p-5">
          {referralCode ? (
            <>
              <div className="flex items-center justify-between gap-3 rounded bg-neutral-100 p-4">
                <code className="min-w-0 flex-1 font-mono text-lg font-bold tracking-wider break-all text-neutral-950">
                  <span className="sr-only">Referral code: </span>
                  {referralCode}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(referralCode, "code")}
                >
                  <Clipboard aria-hidden="true" className="size-4" />
                  {copiedTarget === "code" ? "Copied!" : "Copy"}
                </Button>
              </div>

              {shareLink ? (
                <div className="space-y-2">
                  <label
                    htmlFor="referral-share-link"
                    className="text-sm font-semibold text-neutral-800"
                  >
                    Share Link:
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="referral-share-link"
                      value={shareLink}
                      readOnly
                      className="h-10 min-w-0 flex-1 rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-700"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-lg"
                      aria-label="Copy referral link"
                      onClick={() => copyToClipboard(shareLink, "link")}
                    >
                      <Clipboard aria-hidden="true" className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      aria-label="Share referral link"
                      onClick={() =>
                        shareReferralLink({
                          shareLink,
                          share: navigator.share?.bind(navigator),
                          copyLink: (value) => copyToClipboard(value, "link"),
                        })
                      }
                      className="w-10 px-0 md:w-auto md:px-3"
                    >
                      <Share2 aria-hidden="true" className="size-4" />
                      <span className="hidden md:inline">Share</span>
                    </Button>
                  </div>
                  <p className="min-h-4 text-xs font-medium" aria-live="polite">
                    {copiedTarget === "link" ? (
                      <span className="text-green-700">Referral link copied to clipboard.</span>
                    ) : null}
                  </p>
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-neutral-500">
              Your referral code is being generated. Please refresh the page.
            </p>
          )}
          {copyError ? (
            <p className="text-xs font-medium text-red-600" role="alert">
              {copyError}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <section
        aria-label="Referral statistics"
        className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5"
      >
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </section>

      {summary.rewards.length > 0 ? (
        <Card className={cardClassName}>
          <CardHeader className="border-b border-neutral-100 px-5 py-4">
            <h2 className="text-lg font-semibold text-neutral-950">Recent Rewards</h2>
          </CardHeader>
          <CardContent className="p-5">
            <ul className="space-y-3">
              {summary.rewards.slice(0, 5).map((reward) => (
                <RewardRow key={reward.id} reward={reward} />
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {summary.referrals.length > 0 ? (
        <Card className={cardClassName}>
          <CardHeader className="border-b border-neutral-100 px-5 py-4">
            <h2 className="text-lg font-semibold text-neutral-950">Your Referrals</h2>
          </CardHeader>
          <CardContent className="p-5">
            <ul className="space-y-3">
              {summary.referrals.map((referral) => (
                <li key={referral.id} className="rounded border border-neutral-200 p-3">
                  <p className="text-base font-semibold text-neutral-950">
                    {referral.name || referral.email}
                  </p>
                  <p className="mt-0.5 text-sm text-neutral-500">{referral.email}</p>
                  <p className="mt-2 text-xs text-neutral-500">
                    Joined {formatReferralDate(referral.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card className={cardClassName}>
        <CardHeader className="border-b border-neutral-100 px-5 py-4">
          <h2 className="text-lg font-semibold text-neutral-950">How it works</h2>
        </CardHeader>
        <CardContent className="grid gap-4 p-5 md:grid-cols-3">
          {steps.map((step, index) => (
            <div key={step.title} className="rounded p-2 text-center">
              <div className="mx-auto flex size-8 items-center justify-center rounded-full bg-neutral-950 text-sm font-bold text-white">
                {index + 1}
              </div>
              <h3 className="mt-2 font-semibold text-neutral-950">{step.title}</h3>
              <p className="mt-1 text-sm text-neutral-500">{step.body}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
