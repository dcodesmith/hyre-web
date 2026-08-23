import { describe, expect, it } from "vitest";

import { isLogoutFormAction } from "./user-nav";

describe("isLogoutFormAction", () => {
  it("matches the logout path on a relative or absolute form action", () => {
    expect(isLogoutFormAction("/logout")).toBe(true);
    expect(isLogoutFormAction("https://tripdly.com/logout")).toBe(true);
    expect(isLogoutFormAction("/auth")).toBe(false);
    expect(isLogoutFormAction(undefined)).toBe(false);
  });
});
