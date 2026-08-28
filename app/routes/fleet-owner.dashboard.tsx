import {
  Outlet,
  type ShouldRevalidateFunctionArgs,
  useOutletContext,
  useRevalidator,
} from "react-router";

import { getFleetCars } from "~/api/fleet/cars/cars.server";
import {
  getFleetDashboardOverview,
  getFleetPayoutSummary,
} from "~/api/fleet/dashboard/dashboard.server";
import { Button } from "~/components/ui/button";
import type { Route } from "./+types/fleet-owner.dashboard";
import type { FleetOwnerOutletContext } from "./fleet-owner";

const NO_STORE = { "Cache-Control": "private, no-store" };

export function headers() {
  return NO_STORE;
}

export function shouldRevalidate({
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if (currentUrl.pathname === nextUrl.pathname && currentUrl.search !== nextUrl.search) {
    return false;
  }

  return defaultShouldRevalidate;
}

export async function loader({ request }: Route.LoaderArgs) {
  const carsPromise = getFleetCars({ request }).catch(() => null);
  const [overviewResponse, payoutSummaryResponse, carsResponse] = await Promise.all([
    getFleetDashboardOverview({ request }),
    getFleetPayoutSummary({ request }),
    carsPromise,
  ]);
  const dashboardOverview = overviewResponse.data;
  let vehicleStatusCounts: {
    available: number;
    booked: number;
    maintenance: number;
  } | null = null;

  if (carsResponse) {
    vehicleStatusCounts = {
      available: 0,
      booked: 0,
      maintenance: 0,
    };

    for (const car of carsResponse.data) {
      if (car.status === "AVAILABLE") {
        vehicleStatusCounts.available += 1;
      } else if (car.status === "BOOKED") {
        vehicleStatusCounts.booked += 1;
      } else {
        vehicleStatusCounts.maintenance += 1;
      }
    }
  }

  return {
    overview: {
      totalBookings: dashboardOverview.totalBookings,
      completedBookings: dashboardOverview.completedBookings,
      activeBookings: dashboardOverview.activeBookings,
      cancelledBookings: dashboardOverview.cancelledBookings,
      carsCount: carsResponse?.data.length ?? dashboardOverview.carsCount,
      totalEarnings: dashboardOverview.totalEarnings,
      vehicleStatusCounts,
    },
    payoutSummary: {
      pendingPayouts: payoutSummaryResponse.data.pendingPayouts,
      lastPayoutAt: payoutSummaryResponse.data.lastPayoutAt,
    },
  };
}

export type FleetDashboardOutletContext = Awaited<ReturnType<typeof loader>> & {
  readonly user: FleetOwnerOutletContext;
};

export default function FleetOwnerDashboardLayout({ loaderData }: Route.ComponentProps) {
  const user = useOutletContext<FleetOwnerOutletContext>();

  return <Outlet context={{ ...loaderData, user }} />;
}

export function ErrorBoundary() {
  const revalidator = useRevalidator();

  return (
    <div
      role="alert"
      className="mx-auto flex min-h-80 max-w-lg flex-col items-center justify-center text-center"
    >
      <h2 className="text-xl font-semibold">Unable to load your dashboard</h2>
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
