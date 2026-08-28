import { describe, expect, it } from "vitest";

import {
  fleetDashboardPath,
  parseFleetDashboardView,
  toApiDashboardEarningsSearchParams,
} from "./dashboard-url";

describe("fleet dashboard URL state", () => {
  it("defaults invalid and absent ranges to 30 days", () => {
    expect(parseFleetDashboardView(new URLSearchParams())).toEqual({ range: "30d" });
    expect(parseFleetDashboardView(new URLSearchParams("range=year"))).toEqual({ range: "30d" });
  });

  it("uses compact grouping for each supported range", () => {
    const cases = [
      ["7d", "day"],
      ["30d", "week"],
      ["90d", "month"],
    ] as const;

    for (const [range, groupBy] of cases) {
      expect(Object.fromEntries(toApiDashboardEarningsSearchParams({ range }))).toEqual({
        range,
        groupBy,
      });
    }
  });

  it("omits the default range from canonical paths", () => {
    expect(fleetDashboardPath({ range: "30d" })).toBe("/fleet-owner");
    expect(fleetDashboardPath({ range: "7d" })).toBe("/fleet-owner?range=7d");
  });
});
