import { beforeEach, describe, expect, it, vi } from "vitest";

const { deleteCurrentUserAccount } = vi.hoisted(() => ({
  deleteCurrentUserAccount: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({
  env: {
    API_ORIGIN: "https://api.example",
    APP_ORIGIN: "https://tripdly.com",
  },
}));

vi.mock("~/api/account/account.server", () => ({
  deleteCurrentUserAccount,
}));

import { ApiRequestError } from "~/api/api.server";
import { HTTP_STATUS } from "~/api/http-status";
import { action } from "./api.account.delete";

const SESSION_COOKIE = "better-auth.session_token=test-session";

function apiError(status: number, detail: string, kind: "aborted" | "http" = "http") {
  return new ApiRequestError(kind, status, {
    type: "ACCOUNT_ERROR",
    title: "Account error",
    status,
    detail,
  });
}

function runAction(cookie = SESSION_COOKIE) {
  return action({
    request: new Request("https://tripdly.com/api/account/delete", {
      method: "POST",
      headers: cookie ? { cookie } : undefined,
    }),
    params: {},
  } as Parameters<typeof action>[0]);
}

describe("account deletion action", () => {
  beforeEach(() => {
    deleteCurrentUserAccount.mockReset();
  });

  it("sends guests to login before calling the API", async () => {
    const response = await runAction("").catch((error: unknown) => error);

    expect(deleteCurrentUserAccount).not.toHaveBeenCalled();
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).headers.get("location")).toBe("/auth?redirectTo=%2Fprofile");
  });

  it("sends expired sessions to login", async () => {
    deleteCurrentUserAccount.mockRejectedValueOnce(
      apiError(HTTP_STATUS.UNAUTHORIZED, "Unauthorized"),
    );

    const response = await runAction().catch((error: unknown) => error);

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).headers.get("location")).toBe("/auth?redirectTo=%2Fprofile");
  });

  it("returns API details for expected client failures", async () => {
    deleteCurrentUserAccount.mockRejectedValueOnce(
      apiError(HTTP_STATUS.FORBIDDEN, "Account deletion is not allowed."),
    );

    await expect(runAction()).resolves.toMatchObject({
      data: { error: "Account deletion is not allowed." },
      init: { status: HTTP_STATUS.FORBIDDEN },
    });
  });

  it("hides server details behind a retry message", async () => {
    deleteCurrentUserAccount.mockRejectedValueOnce(
      apiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, "database exploded"),
    );

    await expect(runAction()).resolves.toMatchObject({
      data: { error: "Failed to delete account. Please try again." },
      init: { status: HTTP_STATUS.INTERNAL_SERVER_ERROR },
    });
  });

  it("rethrows an aborted request", async () => {
    const aborted = apiError(HTTP_STATUS.CLIENT_CLOSED_REQUEST, "Aborted", "aborted");
    deleteCurrentUserAccount.mockRejectedValueOnce(aborted);

    await expect(runAction()).rejects.toBe(aborted);
  });

  it("deletes the account, clears auth cookies, and redirects to login", async () => {
    deleteCurrentUserAccount.mockResolvedValueOnce({
      data: { success: true },
      status: HTTP_STATUS.OK,
      headers: new Headers(),
    });

    const response = await runAction().catch((error: unknown) => error);

    expect(deleteCurrentUserAccount).toHaveBeenCalledWith({
      request: expect.any(Request),
    });
    expect(response).toBeInstanceOf(Response);

    const redirectResponse = response as Response;
    expect(redirectResponse.headers.get("location")).toBe("/auth");
    expect(redirectResponse.headers.getSetCookie()).toEqual(
      expect.arrayContaining([
        expect.stringContaining("better-auth.session_token=;"),
        expect.stringContaining("__Host-otp_pending=;"),
      ]),
    );
  });
});
