import { redirect, useRevalidator } from "react-router";

import { getFleetPayoutSummary, getFleetPayouts } from "~/api/fleet/dashboard/dashboard.server";
import { Button } from "~/components/ui/button";
import { FleetPayoutsPage } from "~/fleet/payouts/fleet-payouts-page";
import {
  fleetPayoutsPath,
  PAYOUT_PAGE_SIZE,
  parseFleetPayoutsView,
  toApiPayoutSearchParams,
} from "~/fleet/payouts/payouts-url";
import { buildPageMetadata } from "~/seo/metadata";
import type { Route } from "./+types/fleet-owner.payout-transactions";

const NO_STORE = { "Cache-Control": "private, no-store" };

export const meta = () =>
  buildPageMetadata({
    title: "Payout Transactions | Tripdly",
    description: "View your Tripdly fleet payouts.",
    path: "/fleet-owner/payout-transactions",
    index: false,
  });

export function headers() {
  return NO_STORE;
}

export async function loader({ request }: Route.LoaderArgs) {
  const searchParams = new URL(request.url).searchParams;
  const view = parseFleetPayoutsView(searchParams);

  if (searchParams.has("status") && !view.status) {
    throw redirect(fleetPayoutsPath(view), { headers: NO_STORE });
  }

  const [payoutsResponse, summaryResponse] = await Promise.all([
    getFleetPayouts({ request, searchParams: toApiPayoutSearchParams(view) }),
    getFleetPayoutSummary({ request }),
  ]);
  const totalPages = Math.max(1, Math.ceil(payoutsResponse.data.total / PAYOUT_PAGE_SIZE));

  if (view.page > totalPages) {
    throw redirect(fleetPayoutsPath({ ...view, page: totalPages }), { headers: NO_STORE });
  }

  const payouts = payoutsResponse.data.items.map((payout) => ({
    id: payout.id,
    amountToPay: payout.amountToPay,
    amountPaid: payout.amountPaid,
    currency: payout.currency,
    status: payout.status,
    payoutProviderReference: payout.payoutProviderReference,
    initiatedAt: payout.initiatedAt,
    bookingId: payout.bookingId,
    extensionId: payout.extensionId,
  }));
  const { statusBreakdown, ...summaryTotals } = summaryResponse.data;
  const summary = {
    ...summaryTotals,
    paidOutCount: statusBreakdown.PAID_OUT.count,
    pendingCount:
      statusBreakdown.PENDING_APPROVAL.count +
      statusBreakdown.PENDING_DISBURSEMENT.count +
      statusBreakdown.PROCESSING.count,
    failedCount: statusBreakdown.FAILED.count,
  };

  return {
    payouts,
    summary,
    total: payoutsResponse.data.total,
    view,
  };
}

export default function FleetOwnerPayoutTransactionsRoute({ loaderData }: Route.ComponentProps) {
  return <FleetPayoutsPage {...loaderData} />;
}

export function ErrorBoundary() {
  const revalidator = useRevalidator();

  return (
    <div
      role="alert"
      className="mx-auto flex min-h-80 max-w-lg flex-col items-center justify-center text-center"
    >
      <h2 className="text-xl font-semibold">Unable to load your payouts</h2>
      <p className="mt-2 text-sm text-muted-foreground">Please try again.</p>
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
