import { describe, expect, it } from "vitest";

import {
  parsePendingOtp,
  pendingOtpClearCookie,
  pendingOtpCookieName,
  pendingOtpSetCookie,
  readCookieValue,
  serializePendingOtp,
} from "./pending-otp";

describe("pending OTP cookie", () => {
  it("round-trips a pending login", () => {
    const pending = { email: "ada@tripdly.com", referralCode: "ABCD2345" };

    expect(parsePendingOtp(serializePendingOtp(pending))).toEqual(pending);
  });

  it("stores only supported admin portal roles", () => {
    expect(
      parsePendingOtp(
        encodeURIComponent(JSON.stringify({ email: "ada@tripdly.com", role: "fleetOwner" })),
      ),
    ).toBeNull();
    expect(
      parsePendingOtp(serializePendingOtp({ email: "ada@tripdly.com", role: "staff" })),
    ).toEqual({ email: "ada@tripdly.com", role: "staff" });
  });

  it("rejects an unbounded referral code", () => {
    expect(
      parsePendingOtp(
        encodeURIComponent(
          JSON.stringify({ email: "ada@tripdly.com", referralCode: "not-a-valid-code" }),
        ),
      ),
    ).toBeNull();
  });

  it("uses a host-only name when cookies are secure", () => {
    expect(pendingOtpCookieName(true)).toBe("__Host-otp_pending");
    expect(pendingOtpSetCookie({ email: "ada@tripdly.com" }, true)).toContain("Secure");
    expect(pendingOtpClearCookie(false)).toContain("Max-Age=0");
  });

  it("keeps fleet-owner verification separate from customer verification", () => {
    expect(pendingOtpCookieName(false, "fleetOwner")).toBe("fleet_owner_otp_pending");
    expect(pendingOtpCookieName(true, "fleetOwner")).toBe("__Host-fleet_owner_otp_pending");
    expect(pendingOtpSetCookie({ email: "owner@tripdly.com" }, false, "fleetOwner")).toContain(
      "fleet_owner_otp_pending=",
    );
  });

  it("keeps admin verification separate from other roles", () => {
    expect(pendingOtpCookieName(false, "admin")).toBe("admin_otp_pending");
    expect(pendingOtpCookieName(true, "admin")).toBe("__Host-admin_otp_pending");
  });

  it("reads a named cookie from a header", () => {
    expect(readCookieValue("otp_pending=abc; other=1", "otp_pending")).toBe("abc");
    expect(readCookieValue(null, "otp_pending")).toBeUndefined();
  });
});
