import { env } from "cloudflare:workers";

import { createApiClient } from "~/api/api.server";
import {
  fleetDashboardEarningsSchema,
  fleetDashboardOverviewSchema,
  fleetPayoutSummarySchema,
  fleetPayoutsSchema,
} from "./schema";

let apiClient: ReturnType<typeof createApiClient> | undefined;

function getApiClient() {
  apiClient ??= createApiClient({ apiOrigin: env.API_ORIGIN });
  return apiClient;
}

export function getFleetDashboardOverview({ request }: { readonly request: Request }) {
  return getApiClient().request({
    path: "/api/dashboard/overview",
    request,
    forwardCookie: true,
    schema: fleetDashboardOverviewSchema,
  });
}

export function getFleetDashboardEarnings({
  request,
  searchParams,
}: {
  readonly request: Request;
  readonly searchParams: URLSearchParams;
}) {
  return getApiClient().request({
    path: `/api/dashboard/earnings?${searchParams}`,
    request,
    forwardCookie: true,
    schema: fleetDashboardEarningsSchema,
  });
}

export function getFleetPayouts({
  request,
  searchParams,
}: {
  readonly request: Request;
  readonly searchParams: URLSearchParams;
}) {
  return getApiClient().request({
    path: `/api/dashboard/payouts?${searchParams}`,
    request,
    forwardCookie: true,
    schema: fleetPayoutsSchema,
  });
}

export function getFleetPayoutSummary({ request }: { readonly request: Request }) {
  return getApiClient().request({
    path: "/api/dashboard/payouts/summary",
    request,
    forwardCookie: true,
    schema: fleetPayoutSummarySchema,
  });
}
