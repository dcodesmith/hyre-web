import { redirect, useOutletContext, useRevalidator } from "react-router";
import { getFleetDashboardEarnings } from "~/api/fleet/dashboard/dashboard.server";
import { Button } from "~/components/ui/button";
import {
  DEFAULT_DASHBOARD_RANGE,
  fleetDashboardPath,
  parseFleetDashboardView,
  toApiDashboardEarningsSearchParams,
} from "~/fleet/dashboard/dashboard-url";
import { FleetDashboardPage } from "~/fleet/dashboard/fleet-dashboard-page";
import { buildPageMetadata } from "~/seo/metadata";
import type { Route } from "./+types/fleet-owner._index";
import type { FleetDashboardOutletContext } from "./fleet-owner.dashboard";

const NO_STORE = { "Cache-Control": "private, no-store" };

export const meta = () =>
  buildPageMetadata({
    title: "Fleet Dashboard | Tripdly",
    description: "View your Tripdly fleet and earnings overview.",
    path: "/fleet-owner",
    index: false,
  });

export function headers() {
  return NO_STORE;
}

export async function loader({ request }: Route.LoaderArgs) {
  const searchParams = new URL(request.url).searchParams;
  const view = parseFleetDashboardView(searchParams);
  const requestedRange = searchParams.get("range");

  if (
    requestedRange !== null &&
    (requestedRange !== view.range || view.range === DEFAULT_DASHBOARD_RANGE)
  ) {
    throw redirect(fleetDashboardPath(view), { headers: NO_STORE });
  }

  const earningsResponse = await getFleetDashboardEarnings({
    request,
    searchParams: toApiDashboardEarningsSearchParams(view),
  });
  const earningsData = earningsResponse.data;
  const earnings = {
    range: {
      groupBy: earningsData.range.groupBy,
    },
    totals: {
      gross: earningsData.totals.gross,
      net: earningsData.totals.net,
      fees: earningsData.totals.fees,
      rides: earningsData.totals.rides,
    },
    series: earningsData.series.map((bucket) => ({
      bucketStart: bucket.bucketStart,
      net: bucket.net,
      rides: bucket.rides,
    })),
  };

  return {
    earnings,
    view,
  };
}

export default function FleetOwnerIndex({ loaderData }: Route.ComponentProps) {
  const { overview, payoutSummary, user } = useOutletContext<FleetDashboardOutletContext>();

  return (
    <FleetDashboardPage
      {...loaderData}
      overview={overview}
      payoutSummary={payoutSummary}
      ownerName={user.name?.trim() || "Fleet Owner"}
    />
  );
}

export function ErrorBoundary() {
  const revalidator = useRevalidator();

  return (
    <div
      role="alert"
      className="mx-auto flex min-h-80 max-w-lg flex-col items-center justify-center text-center"
    >
      <h2 className="text-xl font-semibold">Unable to load earnings</h2>
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
