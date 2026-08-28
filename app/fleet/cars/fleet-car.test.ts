import { describe, expect, it } from "vitest";

import { getFleetCarStatusLabel } from "./fleet-car";

describe("fleet car display labels", () => {
  it("uses the hireApp status wording", () => {
    expect(getFleetCarStatusLabel("AVAILABLE")).toBe("Available");
    expect(getFleetCarStatusLabel("BOOKED")).toBe("Booked");
    expect(getFleetCarStatusLabel("HOLD")).toBe("Hold");
    expect(getFleetCarStatusLabel("IN_SERVICE")).toBe("In Service");
  });
});
