import { AlertCircle, Copy, EyeOff } from "lucide-react";
import { useState } from "react";
import type { ReferralSummary } from "~/api/referrals/schema";
import { DetailCard, DetailCardBody, DetailCardHeader } from "~/booking/booking-detail-card";
import { bookingPhoneInputClassName } from "~/booking/booking-phone-verification";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { formatCurrency } from "~/money/currency";

import { useCopyFeedback } from "./use-copy-feedback";

export type ReferralPageSummary = Pick<ReferralSummary, "referralCode" | "programEnabled"> & {
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
};

const referralDateFormatter = new Intl.DateTimeFormat("en-NG", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "Africa/Lagos",
});

const creditBalanceFormatter = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const HISTORY_PAGE_SIZE = 5;
const statCardClassName = "gap-0 rounded-lg border border-neutral-200 py-0 shadow-none ring-0";

function formatReferralDate(value: string) {
  return referralDateFormatter.format(new Date(value));
}

function whatsappShareUrl(shareLink: string) {
  return `https://wa.me/?text=${encodeURIComponent(
    `Book your first Tripdly trip with my referral link: ${shareLink}`,
  )}`;
}

function telegramShareUrl(shareLink: string) {
  return `https://t.me/share/url?url=${encodeURIComponent(
    shareLink,
  )}&text=${encodeURIComponent("Book your first Tripdly trip with my referral link.")}`;
}

function StatCard({ label, value }: { readonly label: string; readonly value: string | number }) {
  return (
    <Card className={statCardClassName}>
      <CardContent className="flex min-h-32 flex-col justify-between p-4">
        <span aria-hidden="true" className="size-8 rounded-full bg-neutral-100" />
        <div className="space-y-1">
          <p className="text-xl leading-5 font-semibold text-neutral-950 tabular-nums">{value}</p>
          <p className="text-xs leading-3 font-medium text-neutral-500">{label}</p>
        </div>
      </CardContent>
    </Card>
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
  const [historyPage, setHistoryPage] = useState(1);
  const { referralCode } = summary;
  const historyPageCount = Math.max(1, Math.ceil(summary.referrals.length / HISTORY_PAGE_SIZE));
  const visibleReferrals = summary.referrals.slice(
    (historyPage - 1) * HISTORY_PAGE_SIZE,
    historyPage * HISTORY_PAGE_SIZE,
  );
  const stats = [
    {
      label: "Rewards earned",
      value: formatCurrency(summary.stats.totalRewardsGranted),
    },
    {
      label: "Pending Rewards",
      value: formatCurrency(summary.stats.totalRewardsPending),
    },
    {
      label: "Used Credits",
      value: formatCurrency(summary.stats.totalUsed),
    },
    {
      label: "Total Referrals",
      value: summary.stats.totalReferrals,
    },
  ];

  return (
    <section
      aria-labelledby="referral-page-title"
      className="mx-auto max-w-4xl space-y-4 px-5 py-6 pb-24 md:px-4 md:py-12"
    >
      <header className="mb-2 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
        <h1
          id="referral-page-title"
          className="text-2xl leading-9 font-semibold text-neutral-900 md:text-3xl"
        >
          Referral Program
        </h1>
        <p className="text-sm font-medium">
          <span className="text-neutral-500">New to Tripidly? </span>
          <span className="underline underline-offset-2">See how it works</span>
        </p>
      </header>

      {!summary.programEnabled ? (
        <Alert className="rounded-md border-yellow-500 bg-yellow-50 p-4 text-yellow-600 md:mb-4">
          <AlertCircle aria-hidden="true" className="size-4" />
          <AlertTitle className="text-base leading-4">
            Referral program temporarily closed
          </AlertTitle>
          <AlertDescription className="text-yellow-600">
            New referrals cannot be processed at this time.
          </AlertDescription>
        </Alert>
      ) : null}

      <DetailCard>
        <DetailCardHeader>
          <h2>Invite friends and Earn</h2>
        </DetailCardHeader>
        <DetailCardBody>
          <div className="grid min-h-[456px] gap-8 md:min-h-[216px] md:grid-cols-[316px_minmax(0,1fr)] md:gap-6">
            <div className="relative h-52 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-900 p-5 text-white">
              <p className="text-sm font-medium text-neutral-300">Available Credits</p>
              <p className="mt-1 text-3xl leading-8 font-semibold tabular-nums">
                {creditBalanceFormatter.format(summary.stats.availableCredits)}
              </p>
              <img src="/referrals/credit-bag.svg" alt="" className="absolute bottom-3 left-1" />
              <EyeOff
                aria-hidden="true"
                className="absolute top-5 right-5 size-4 text-neutral-300"
              />
            </div>

            <div className="space-y-6">
              {referralCode ? (
                <div className="space-y-2">
                  <label htmlFor="referral-code" className="text-sm font-semibold text-neutral-900">
                    Your Referral Code
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="referral-code"
                      value={referralCode}
                      readOnly
                      className={bookingPhoneInputClassName}
                    />
                    <Button
                      type="button"
                      className="h-10 rounded-md px-3.5"
                      onClick={() => copyToClipboard(referralCode, "code")}
                    >
                      <Copy aria-hidden="true" />
                      {copiedTarget === "code" ? "Copied!" : "Copy"}
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-neutral-500">
                  Your referral code is being generated. Please refresh the page.
                </p>
              )}

              {shareLink ? (
                <div className="space-y-2">
                  <label
                    htmlFor="referral-share-link"
                    className="text-sm font-semibold text-neutral-900"
                  >
                    Your Referral Link
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="referral-share-link"
                      value={shareLink}
                      readOnly
                      className={bookingPhoneInputClassName}
                    />
                    <Button
                      type="button"
                      className="h-10 rounded-md px-3.5"
                      onClick={() => copyToClipboard(shareLink, "link")}
                    >
                      <Copy aria-hidden="true" />
                      {copiedTarget === "link" ? "Copied!" : "Copy"}
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-neutral-500">SHARE VIA:</span>
                    <a
                      href={whatsappShareUrl(shareLink)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-xl border border-neutral-300 px-2 py-1 text-xs"
                    >
                      <img src="/referrals/whatsapp.svg" alt="" />
                      Whatsapp
                    </a>
                    <a
                      href={telegramShareUrl(shareLink)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-xl border border-neutral-300 px-2 py-1 text-xs"
                    >
                      <img src="/referrals/telegram.svg" alt="" />
                      Telegram
                    </a>
                  </div>
                </div>
              ) : null}

              <div className="text-xs font-medium" aria-live="polite">
                {copiedTarget ? <span className="text-green-700">Copied to clipboard.</span> : null}
              </div>
              {copyError ? (
                <p className="text-xs font-medium text-red-600" role="alert">
                  {copyError}
                </p>
              ) : null}
            </div>
          </div>
        </DetailCardBody>
      </DetailCard>

      <section aria-label="Referral statistics" className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </section>

      <DetailCard className="min-h-[545px] md:min-h-[398px]">
        <DetailCardHeader>
          <h2>Your Referral History</h2>
        </DetailCardHeader>
        <DetailCardBody>
          {summary.referrals.length > 0 ? (
            <div className="space-y-4">
              <Table>
                <TableCaption className="sr-only">
                  People who joined using your referral code
                </TableCaption>
                <TableHeader className="bg-neutral-100">
                  <TableRow>
                    <TableHead scope="col" className="text-xs font-semibold">
                      Name
                    </TableHead>
                    <TableHead scope="col" className="text-xs font-semibold">
                      Email
                    </TableHead>
                    <TableHead scope="col" className="text-xs font-semibold">
                      Joined
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleReferrals.map((referral) => (
                    <TableRow key={referral.id}>
                      <TableCell>{referral.name || "—"}</TableCell>
                      <TableCell>{referral.email}</TableCell>
                      <TableCell>{formatReferralDate(referral.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <nav
                aria-label="Referral history pagination"
                className="flex items-center justify-between gap-4"
              >
                <p className="text-sm">
                  Page {historyPage}/{historyPageCount}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={historyPage === 1}
                    onClick={() => setHistoryPage((page) => page - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={historyPage === historyPageCount}
                    onClick={() => setHistoryPage((page) => page + 1)}
                  >
                    Next
                  </Button>
                </div>
              </nav>
            </div>
          ) : (
            <div className="flex min-h-80 flex-col items-center justify-center px-2 text-center">
              <img src="/referrals/empty-history.svg" alt="" />
              <h3 className="mt-4 text-base font-semibold text-neutral-900">No referral history</h3>
              <p className="mt-1 max-w-72 text-sm text-neutral-600">
                Your referral history will appear here. You can share your referral link to get
                started
              </p>
            </div>
          )}
        </DetailCardBody>
      </DetailCard>
    </section>
  );
}
