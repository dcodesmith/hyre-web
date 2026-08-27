import { describe, expect, it } from "vitest";

import { isLogoutFormAction } from "./logout-navigation";
import { getUserInitials } from "./user";

describe("isLogoutFormAction", () => {
  it("matches the logout path on a relative or absolute form action", () => {
    expect(isLogoutFormAction("/logout")).toBe(true);
    expect(isLogoutFormAction("https://tripdly.com/logout")).toBe(true);
    expect(isLogoutFormAction("/auth")).toBe(false);
    expect(isLogoutFormAction(undefined)).toBe(false);
  });
});

describe("getUserInitials", () => {
  it("uses the first and last name letters", () => {
    expect(getUserInitials({ name: "Ada Lovelace", email: "ada@example.com" })).toBe("AL");
  });

  it("uses a single name letter", () => {
    expect(getUserInitials({ name: "Ada", email: "ada@example.com" })).toBe("A");
  });

  it("falls back to the email when the name is missing", () => {
    expect(getUserInitials({ name: null, email: "bola@example.com" })).toBe("B");
  });
});
