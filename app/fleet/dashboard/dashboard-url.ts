import {
  type DashboardGroupBy,
  type DashboardRange,
  dashboardRangeSchema,
} from "~/api/fleet/dashboard/schema";

export const DEFAULT_DASHBOARD_RANGE: DashboardRange = "30d";

export type FleetDashboardView = {
  readonly range: DashboardRange;
};

const GROUP_BY_RANGE: Readonly<Record<DashboardRange, DashboardGroupBy>> = {
  "7d": "day",
  "30d": "week",
  "90d": "month",
};

export function parseFleetDashboardView(searchParams: URLSearchParams): FleetDashboardView {
  const range = dashboardRangeSchema.safeParse(searchParams.get("range"));

  return {
    range: range.success ? range.data : DEFAULT_DASHBOARD_RANGE,
  };
}

export function fleetDashboardPath(view: FleetDashboardView) {
  return view.range === DEFAULT_DASHBOARD_RANGE
    ? "/fleet-owner"
    : `/fleet-owner?range=${view.range}`;
}

export function toApiDashboardEarningsSearchParams(view: FleetDashboardView) {
  return new URLSearchParams({
    range: view.range,
    groupBy: GROUP_BY_RANGE[view.range],
  });
}
