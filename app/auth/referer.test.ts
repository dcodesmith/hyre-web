import { describe, expect, it } from "vitest";

import { authReferer, safeRedirectPath } from "./referer";

describe("authReferer", () => {
  it("builds a role-scoped referer from the app origin", () => {
    expect(authReferer("https://tripdly.com", "user")).toBe("https://tripdly.com/auth");
    expect(authReferer("https://tripdly.com/", "fleetOwner")).toBe(
      "https://tripdly.com/fleet-owner/login",
    );
    expect(authReferer("https://tripdly.com", "admin")).toBe("https://tripdly.com/admin/login");
  });
});

describe("safeRedirectPath", () => {
  it("rejects protocol-relative and off-site targets", () => {
    expect(safeRedirectPath("/bookings")).toBe("/bookings");
    expect(safeRedirectPath("//evil.example")).toBe("/");
    expect(safeRedirectPath("https://evil.example")).toBe("/");
    expect(safeRedirectPath("\\auth")).toBe("/");
  });
});
