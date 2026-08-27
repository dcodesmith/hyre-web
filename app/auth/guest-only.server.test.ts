import { beforeEach, describe, expect, it, vi } from "vitest";

const { readAuthUser } = vi.hoisted(() => ({
  readAuthUser: vi.fn(),
}));

vi.mock("~/auth/session.server", () => ({
  readAuthUser,
}));

import { redirectAuthenticatedUser } from "./guest-only.server";

describe("redirectAuthenticatedUser", () => {
  beforeEach(() => {
    readAuthUser.mockReset();
  });

  it("leaves guests on guest-only routes", async () => {
    readAuthUser.mockResolvedValue(null);

    await expect(
      redirectAuthenticatedUser(new Request("https://tripdly.com/auth")),
    ).resolves.toBeUndefined();
  });

  it("redirects an authenticated user to the safe requested path", async () => {
    readAuthUser.mockResolvedValue({ email: "ada@example.com", name: "Ada Lovelace" });

    let response: unknown;
    try {
      await redirectAuthenticatedUser(
        new Request("https://tripdly.com/auth?redirectTo=%2Fcars%2Flexus-ux"),
      );
    } catch (error) {
      response = error;
    }

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(302);
    expect((response as Response).headers.get("Location")).toBe("/cars/lexus-ux");
    expect((response as Response).headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("does not hide session lookup failures", async () => {
    const error = new Error("API unavailable");
    readAuthUser.mockRejectedValue(error);

    await expect(redirectAuthenticatedUser(new Request("https://tripdly.com/auth"))).rejects.toBe(
      error,
    );
  });
});
