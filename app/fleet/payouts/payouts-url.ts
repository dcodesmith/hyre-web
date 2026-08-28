import { z } from "zod";

import { type PayoutStatus, payoutStatusSchema } from "~/api/fleet/dashboard/schema";

export const PAYOUT_PAGE_SIZE = 20;

export type FleetPayoutsView = {
  readonly page: number;
  readonly status: PayoutStatus | null;
};

export function parseFleetPayoutsView(searchParams: URLSearchParams): FleetPayoutsView {
  const parsedStatus = payoutStatusSchema.safeParse(searchParams.get("status"));

  return {
    page: z.coerce
      .number()
      .int()
      .positive()
      .catch(1)
      .parse(searchParams.get("page") ?? 1),
    status: parsedStatus.success ? parsedStatus.data : null,
  };
}

export function serializeFleetPayoutsView(view: FleetPayoutsView) {
  const searchParams = new URLSearchParams();

  if (view.status) {
    searchParams.set("status", view.status);
  }
  if (view.page > 1) {
    searchParams.set("page", String(view.page));
  }

  return searchParams;
}

export function fleetPayoutsPath(view: FleetPayoutsView) {
  const path = "/fleet-owner/payout-transactions";
  const search = serializeFleetPayoutsView(view).toString();
  return search ? `${path}?${search}` : path;
}

export function toApiPayoutSearchParams(view: FleetPayoutsView) {
  const searchParams = new URLSearchParams({
    page: String(view.page),
    limit: String(PAYOUT_PAGE_SIZE),
  });

  if (view.status) {
    searchParams.set("status", view.status);
  }

  return searchParams;
}
