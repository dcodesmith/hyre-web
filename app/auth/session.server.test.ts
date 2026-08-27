import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiRequestError } from "~/api/api.server";

const { getAuthSession } = vi.hoisted(() => ({
  getAuthSession: vi.fn(),
}));

vi.mock("~/api/auth/auth.server", () => ({
  getAuthSession,
}));

import { readAuthUser } from "./session.server";

const SESSION_COOKIE = "better-auth.session_token=test-session";

function requestWithCookie(cookie = SESSION_COOKIE) {
  return new Request("https://tripdly.com/", { headers: { Cookie: cookie } });
}

describe("readAuthUser", () => {
  beforeEach(() => {
    getAuthSession.mockReset();
  });

  it("returns null when there is no session cookie", async () => {
    await expect(readAuthUser(new Request("https://tripdly.com/"))).resolves.toBeNull();
    expect(getAuthSession).not.toHaveBeenCalled();
  });

  it("reads email and name from the API session envelope", async () => {
    getAuthSession.mockResolvedValue({
      data: {
        user: { id: "user-1", email: "ada@example.com", name: "Ada Lovelace", roles: ["user"] },
        session: {},
      },
      status: 200,
      headers: new Headers(),
    });

    await expect(readAuthUser(requestWithCookie())).resolves.toEqual({
      email: "ada@example.com",
      name: "Ada Lovelace",
    });
  });

  it("treats a blank name as missing", async () => {
    getAuthSession.mockResolvedValue({
      data: {
        user: { id: "user-1", email: "ada@example.com", name: "  ", roles: ["user"] },
        session: {},
      },
      status: 200,
      headers: new Headers(),
    });

    await expect(readAuthUser(requestWithCookie())).resolves.toEqual({
      email: "ada@example.com",
      name: null,
    });
  });

  it("treats an API 401 response as a missing session", async () => {
    const status = 401;
    getAuthSession.mockRejectedValue(
      new ApiRequestError("http", status, {
        type: "AUTH_ERROR",
        title: "Authentication failed",
        status,
        detail: "The session is no longer valid.",
      }),
    );

    await expect(readAuthUser(requestWithCookie())).resolves.toBeNull();
  });

  it("does not hide API authorization failures", async () => {
    const error = new ApiRequestError("http", 403, {
      type: "AUTH_ERROR",
      title: "Authentication failed",
      status: 403,
      detail: "The session is not authorized.",
    });
    getAuthSession.mockRejectedValue(error);

    await expect(readAuthUser(requestWithCookie())).rejects.toBe(error);
  });

  it("does not hide API availability failures", async () => {
    const error = new ApiRequestError("network", 502, {
      type: "NETWORK_ERROR",
      title: "API unavailable",
      status: 502,
      detail: "The API could not be reached.",
    });
    getAuthSession.mockRejectedValue(error);

    await expect(readAuthUser(requestWithCookie())).rejects.toBe(error);
  });
});
