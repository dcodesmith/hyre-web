import { env } from "cloudflare:workers";
import { redirect, useRevalidator } from "react-router";

import { ApiRequestError } from "~/api/api.server";
import { hasSessionCookie } from "~/api/auth/cookie-relay.server";
import { HTTP_STATUS } from "~/api/http-status";
import { getCurrentUserReferralSummary } from "~/api/referrals/referrals.server";
import { AUTH_NO_STORE } from "~/auth/guest-only.server";
import { authPath } from "~/auth/referer";
import { Button } from "~/components/ui/button";
import { ReferralPage, type ReferralPageSummary } from "~/referral/referral-page";
import { buildPageMetadata } from "~/seo/metadata";
import type { Route } from "./+types/referrals";

export const meta = () =>
  buildPageMetadata({
    title: "Referral Program | Tripdly",
    description: "Invite friends and view your Tripdly referral rewards and booking credits.",
    path: "/referrals",
    index: false,
  });

export function headers() {
  return AUTH_NO_STORE;
}

function loginRedirect(request: Request) {
  const url = new URL(request.url);
  return redirect(authPath("/auth", { redirectTo: `${url.pathname}${url.search}` }), {
    headers: AUTH_NO_STORE,
  });
}

export async function loader({ request }: Route.LoaderArgs) {
  if (!hasSessionCookie(request.headers.get("Cookie"))) {
    throw loginRedirect(request);
  }

  try {
    const { data: summary } = await getCurrentUserReferralSummary({ request });
    const shareLink = summary.referralCode
      ? new URL(`/auth?ref=${encodeURIComponent(summary.referralCode)}`, env.APP_ORIGIN).toString()
      : null;
    const pageSummary: ReferralPageSummary = {
      referralCode: summary.referralCode,
      programEnabled: summary.programEnabled,
      discountAmount: summary.discountAmount,
      stats: {
        totalReferrals: summary.stats.totalReferrals,
        totalRewardsGranted: summary.stats.totalRewardsGranted,
        totalRewardsPending: summary.stats.totalRewardsPending,
        totalUsed: summary.stats.totalUsed,
        availableCredits: summary.stats.availableCredits,
      },
      referrals: summary.referrals.map(({ id, name, email, createdAt }) => ({
        id,
        name,
        email,
        createdAt,
      })),
      rewards: summary.rewards.map(({ id, amount, status, createdAt, refereeName }) => ({
        id,
        amount,
        status,
        createdAt,
        refereeName,
      })),
    };

    return { summary: pageSummary, shareLink };
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === HTTP_STATUS.UNAUTHORIZED) {
      throw loginRedirect(request);
    }

    throw error;
  }
}

export default function ReferralsRoute({ loaderData }: Route.ComponentProps) {
  return <ReferralPage summary={loaderData.summary} shareLink={loaderData.shareLink} />;
}

export function ErrorBoundary() {
  const revalidator = useRevalidator();

  return (
    <div className="mx-auto flex min-h-100 max-w-lg flex-col items-center justify-center px-6 text-center">
      <h1 className="text-xl font-semibold text-red-700">Unable to load referrals</h1>
      <p className="mt-2 text-sm text-red-600">Please try again.</p>
      <Button
        type="button"
        className="mt-5"
        disabled={revalidator.state !== "idle"}
        onClick={() => revalidator.revalidate()}
      >
        {revalidator.state === "idle" ? "Retry" : "Retrying…"}
      </Button>
    </div>
  );
}
