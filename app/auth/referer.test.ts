import { describe, expect, it } from "vitest";

import { authPath, authReferer, safeRedirectPath } from "./referer";

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
  it("rejects protocol-relative, off-site, and control-character targets", () => {
    expect(safeRedirectPath("/bookings")).toBe("/bookings");
    expect(safeRedirectPath("//evil.example")).toBe("/");
    expect(safeRedirectPath("https://evil.example")).toBe("/");
    expect(safeRedirectPath("\\auth")).toBe("/");
    expect(safeRedirectPath("/\\evil.example")).toBe("/");
    expect(safeRedirectPath("/bookings\r\nSet-Cookie: a=1")).toBe("/");
    expect(safeRedirectPath("/bookings\0")).toBe("/");
  });

  it("keeps encoded slashes as a same-origin path", () => {
    expect(safeRedirectPath("/%2f%2fevil.example")).toBe("/%2f%2fevil.example");
  });

  it("strips React Router data-request suffixes from redirect targets", () => {
    expect(safeRedirectPath("/bookings/booking-1.data")).toBe("/bookings/booking-1");
    expect(safeRedirectPath("/bookings/booking-1.data?_routes=routes/bookings.$bookingId")).toBe(
      "/bookings/booking-1",
    );
    expect(safeRedirectPath("/bookings?status=completed")).toBe("/bookings?status=completed");
  });
});

describe("authPath", () => {
  it("keeps a safe redirectTo and a valid referral on /auth", () => {
    expect(authPath("/auth", { redirectTo: "/cars/abc", ref: "abcd2345" })).toBe(
      "/auth?redirectTo=%2Fcars%2Fabc&ref=ABCD2345",
    );
    expect(authPath("/auth", { redirectTo: "/bookings?status=completed" })).toBe(
      "/auth?redirectTo=%2Fbookings%3Fstatus%3Dcompleted",
    );
    expect(authPath("/auth", { redirectTo: "/profile" })).toBe("/auth?redirectTo=%2Fprofile");
    expect(authPath("/auth", { redirectTo: "/bookings/booking-1" })).toBe(
      "/auth?redirectTo=%2Fbookings%2Fbooking-1",
    );
    expect(authPath("/auth", { redirectTo: "/bookings/booking-1.data" })).toBe(
      "/auth?redirectTo=%2Fbookings%2Fbooking-1",
    );
  });

  it("omits home redirects, invalid refs, and unsafe targets", () => {
    expect(authPath("/auth", { redirectTo: "/", ref: "nope" })).toBe("/auth");
    expect(authPath("/verify", { redirectTo: "//evil.example", ref: "ABCD2345" })).toBe("/verify");
    expect(authPath("/verify", { redirectTo: "/bookings", ref: "ABCD2345" })).toBe(
      "/verify?redirectTo=%2Fbookings",
    );
  });
});
