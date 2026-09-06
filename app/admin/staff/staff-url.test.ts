import { describe, expect, it } from "vitest";

import { isAddStaffOpen, parseStaffQuery, serializeStaffQuery, staffHref } from "./staff-url";

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

  it("builds staff list and add-dialog hrefs without sending add to the API query", () => {
    expect(staffHref({ page: 1, limit: 20 })).toBe("/admin/staff");
    expect(staffHref({ status: "active", page: 1, limit: 20 }, { add: true })).toBe(
      "/admin/staff?status=active&add=1",
    );
    expect(isAddStaffOpen(new URLSearchParams("status=active&add=1"))).toBe(true);
    expect(parseStaffQuery(new URLSearchParams("status=active&add=1"))).toEqual({
      status: "active",
      page: 1,
      limit: 20,
    });
  });
});
