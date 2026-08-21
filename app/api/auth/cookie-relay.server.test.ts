import { describe, expect, it } from "vitest";

import { appendSetCookies, authResponseHeaders, expireSessionCookies } from "./cookie-relay.server";

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

describe("expireSessionCookies", () => {
  it("expires both host and non-host session cookies", () => {
    const cookies = expireSessionCookies();

    expect(cookies.some((cookie) => cookie.startsWith("session_token=;"))).toBe(true);
    expect(
      cookies.some(
        (cookie) => cookie.startsWith("__Host-session_token=;") && cookie.includes("Secure"),
      ),
    ).toBe(true);
    expect(cookies.every((cookie) => cookie.includes("Max-Age=0"))).toBe(true);
  });
});
