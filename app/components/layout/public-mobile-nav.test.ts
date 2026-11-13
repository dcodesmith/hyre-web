import { describe, expect, it } from "vitest";

import { mobileNavLinks } from "./public-mobile-nav";

describe("mobileNavLinks", () => {
  it("shows four links when logged out and when logged in", () => {
    expect(mobileNavLinks(false).map(({ label, to }) => [label, to])).toEqual([
      ["Tripdly", "/"],
      ["Bookings", "/bookings"],
      ["Referrals", "/referrals"],
      ["Login", "/auth"],
    ]);
    expect(mobileNavLinks(true).map(({ label, to }) => [label, to])).toEqual([
      ["Tripdly", "/"],
      ["Bookings", "/bookings"],
      ["Referrals", "/referrals"],
      ["Profile", "/profile"],
    ]);
  });
});
