import { describe, expect, it } from "vitest";

import { fleetOwnerRoleLabel } from "./fleet-owner-role";

describe("fleetOwnerRoleLabel", () => {
  it("names the three fleet accounts", () => {
    expect(fleetOwnerRoleLabel({ accountType: "INDIVIDUAL", isOwnerDriver: true })).toBe(
      "Owner-driver",
    );
    expect(fleetOwnerRoleLabel({ accountType: "INDIVIDUAL", isOwnerDriver: false })).toBe(
      "Individual",
    );
    expect(fleetOwnerRoleLabel({ accountType: "BUSINESS", isOwnerDriver: false })).toBe("Business");
  });
});
