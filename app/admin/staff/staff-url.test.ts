import { describe, expect, it } from "vitest";

import { parseStaffQuery, serializeStaffQuery } from "./staff-url";

describe("staff URL", () => {
  it("parses the API-supported filter and pagination values", () => {
    expect(parseStaffQuery(new URLSearchParams("status=revoked&page=2&limit=50"))).toEqual({
      status: "revoked",
      page: 2,
      limit: 50,
    });
  });

  it("normalizes invalid values to defaults", () => {
    expect(parseStaffQuery(new URLSearchParams("status=pending&page=0&limit=101"))).toEqual({
      page: 1,
      limit: 20,
    });
  });

  it("omits default pagination values when serializing", () => {
    expect(serializeStaffQuery({ status: "active", page: 1, limit: 20 }).toString()).toBe(
      "status=active",
    );
  });
});
