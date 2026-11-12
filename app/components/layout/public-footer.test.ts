import { describe, expect, it } from "vitest";

import { hidesPublicFooter } from "./public-footer";

describe("hidesPublicFooter", () => {
  it("hides the marketing footer on profile, booking, and referral pages", () => {
    expect(hidesPublicFooter("/profile")).toBe(true);
    expect(hidesPublicFooter("/referrals")).toBe(true);
    expect(hidesPublicFooter("/bookings")).toBe(true);
    expect(hidesPublicFooter("/bookings/lookup")).toBe(true);
    expect(hidesPublicFooter("/bookings/018f47a2-7b3c-7d4e-8f90-123456789403")).toBe(true);
    expect(hidesPublicFooter("/bookings/018f47a2-7b3c-7d4e-8f90-123456789403/extend")).toBe(true);
    expect(hidesPublicFooter("/bookings/payment-status")).toBe(true);
    expect(hidesPublicFooter("/__visual/profile")).toBe(true);
    expect(hidesPublicFooter("/__visual/referrals")).toBe(true);
    expect(hidesPublicFooter("/__visual/bookings")).toBe(true);
    expect(hidesPublicFooter("/__visual/booking")).toBe(true);
    expect(hidesPublicFooter("/__visual/booking-extend")).toBe(true);
  });

  it("keeps the footer on public marketing pages", () => {
    expect(hidesPublicFooter("/")).toBe(false);
    expect(hidesPublicFooter("/search")).toBe(false);
    expect(hidesPublicFooter("/about")).toBe(false);
    expect(hidesPublicFooter("/cars/lexus-ux")).toBe(false);
    expect(hidesPublicFooter("/__visual/home")).toBe(false);
    expect(hidesPublicFooter("/__visual/public-shell")).toBe(false);
  });
});
