import { describe, expect, it } from "vitest";

import {
  fleetPayoutsPath,
  parseFleetPayoutsView,
  serializeFleetPayoutsView,
  toApiPayoutSearchParams,
} from "./payouts-url";

describe("fleet payouts URL", () => {
  it("parses valid status and pagination", () => {
    expect(parseFleetPayoutsView(new URLSearchParams("status=PAID_OUT&page=3"))).toEqual({
      status: "PAID_OUT",
      page: 3,
    });
  });

  it("normalizes invalid values", () => {
    expect(parseFleetPayoutsView(new URLSearchParams("status=UNKNOWN&page=-2"))).toEqual({
      status: null,
      page: 1,
    });
  });

  it("round trips browser state and adds the API page size", () => {
    const view = { status: "PROCESSING" as const, page: 2 };

    expect(parseFleetPayoutsView(serializeFleetPayoutsView(view))).toEqual(view);
    expect(toApiPayoutSearchParams(view).toString()).toBe("page=2&limit=20&status=PROCESSING");
    expect(fleetPayoutsPath(view)).toBe(
      "/fleet-owner/payout-transactions?status=PROCESSING&page=2",
    );
  });
});
