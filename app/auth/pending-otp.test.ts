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

  it("drops a forged role from an older cookie", () => {
    expect(
      parsePendingOtp(
        encodeURIComponent(JSON.stringify({ email: "ada@tripdly.com", role: "fleetOwner" })),
      ),
    ).toEqual({ email: "ada@tripdly.com" });
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

  it("reads a named cookie from a header", () => {
    expect(readCookieValue("otp_pending=abc; other=1", "otp_pending")).toBe("abc");
    expect(readCookieValue(null, "otp_pending")).toBeUndefined();
  });
});
