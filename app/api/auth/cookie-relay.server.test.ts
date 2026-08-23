import { describe, expect, it } from "vitest";

import {
  appendSetCookies,
  authResponseHeaders,
  expireSessionCookies,
  hasSessionCookie,
} from "./cookie-relay.server";

describe("appendSetCookies", () => {
  it("copies every Set-Cookie without joining them", () => {
    const source = new Headers();
    source.append("Set-Cookie", "session_token=one; Path=/; HttpOnly");
    source.append("Set-Cookie", "session_data=two; Path=/; HttpOnly");

    const target = appendSetCookies(new Headers(), source);

    expect(target.getSetCookie()).toEqual([
      "session_token=one; Path=/; HttpOnly",
      "session_data=two; Path=/; HttpOnly",
    ]);
  });
});

describe("authResponseHeaders", () => {
  it("marks auth responses uncached", () => {
    expect(authResponseHeaders().get("Cache-Control")).toBe("private, no-store");
  });
});

describe("hasSessionCookie", () => {
  it("ignores missing cookies and the pending OTP cookie", () => {
    expect(hasSessionCookie(null)).toBe(false);
    expect(hasSessionCookie("otp_pending=abc")).toBe(false);
  });

  it("detects Better Auth session cookies", () => {
    expect(hasSessionCookie("better-auth.session_token=one; other=1")).toBe(true);
    expect(hasSessionCookie("__Secure-better-auth.session_data=two")).toBe(true);
    expect(hasSessionCookie("__Host-.session_token=three")).toBe(true);
    expect(hasSessionCookie("__Secure-__Host-.session_data=four")).toBe(true);
  });

  it("ignores unrelated cookie names", () => {
    expect(hasSessionCookie("marketing_session_token=1; otp_pending=abc")).toBe(false);
    expect(hasSessionCookie("session_token_backup=1")).toBe(false);
  });
});

describe("expireSessionCookies", () => {
  it("expires Better Auth names and Path=/", () => {
    const cookies = expireSessionCookies();

    expect(cookies.some((cookie) => cookie.startsWith("better-auth.session_token=;"))).toBe(true);
    expect(
      cookies.some(
        (cookie) =>
          cookie.startsWith("__Secure-better-auth.session_token=;") &&
          cookie.includes("Path=/") &&
          cookie.includes("Secure"),
      ),
    ).toBe(true);
    expect(
      cookies.every((cookie) => cookie.includes("Path=/") && cookie.includes("Max-Age=0")),
    ).toBe(true);
  });

  it("expires production Better Auth names without touching unrelated cookies", () => {
    const cookies = expireSessionCookies(
      "__Secure-__Host-.session_token=abc; marketing_session_token=1; other=1",
    );

    expect(cookies.some((cookie) => cookie.startsWith("__Secure-__Host-.session_token=;"))).toBe(
      true,
    );
    expect(cookies.some((cookie) => cookie.startsWith("marketing_session_token="))).toBe(false);
  });
});
