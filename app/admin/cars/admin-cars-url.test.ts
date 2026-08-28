import { describe, expect, it } from "vitest";

import { parseAdminCarsQuery, serializeAdminCarsQuery } from "./admin-cars-url";

describe("admin cars URL", () => {
  it("parses the API-supported filter and pagination values", () => {
    expect(
      parseAdminCarsQuery(new URLSearchParams("approvalStatus=PENDING&page=2&limit=50")),
    ).toEqual({
      approvalStatus: "PENDING",
      page: 2,
      limit: 50,
    });
  });

  it("normalizes invalid values to defaults", () => {
    expect(
      parseAdminCarsQuery(new URLSearchParams("approvalStatus=UNKNOWN&page=-1&limit=500")),
    ).toEqual({
      page: 1,
      limit: 20,
    });
  });

  it("omits default pagination values when serializing", () => {
    expect(
      serializeAdminCarsQuery({
        approvalStatus: "APPROVED",
        page: 1,
        limit: 20,
      }).toString(),
    ).toBe("approvalStatus=APPROVED");
  });
});
