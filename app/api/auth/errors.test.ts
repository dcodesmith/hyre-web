import { describe, expect, it } from "vitest";

import { ApiRequestError } from "../api.server";
import { HTTP_STATUS } from "../http-status";
import { authClientErrorMessage, authClientErrorStatus } from "./errors";

function httpError(status: number, detail: string, headers?: Headers) {
  return new ApiRequestError(
    "http",
    status,
    {
      type: "BETTER_AUTH_ERROR",
      title: "Error",
      status,
      detail,
    },
    headers,
  );
}

describe("authClientErrorMessage", () => {
  it("hides role-forbidden details", () => {
    expect(
      authClientErrorMessage(
        httpError(HTTP_STATUS.FORBIDDEN, 'Role "admin" is not allowed from this client'),
      ),
    ).toBe("We couldn't start the login process. Please check your details and try again.");
  });

  it("surfaces invalid OTP and retry-after", () => {
    expect(authClientErrorMessage(httpError(HTTP_STATUS.BAD_REQUEST, "Invalid OTP"))).toBe(
      "Invalid OTP",
    );
    expect(
      authClientErrorMessage(
        httpError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          "Too many requests",
          new Headers({ "x-retry-after": "30" }),
        ),
      ),
    ).toBe("Too many attempts. Try again in 30 seconds.");
  });

  it("does not leak 5xx details", () => {
    expect(authClientErrorMessage(httpError(HTTP_STATUS.BAD_GATEWAY, "database password"))).toBe(
      "Something went wrong. Please try again.",
    );
  });
});

describe("authClientErrorStatus", () => {
  it("keeps 429 and maps 5xx to 502", () => {
    expect(
      authClientErrorStatus(httpError(HTTP_STATUS.TOO_MANY_REQUESTS, "Too many requests")),
    ).toBe(HTTP_STATUS.TOO_MANY_REQUESTS);
    expect(authClientErrorStatus(httpError(HTTP_STATUS.BAD_GATEWAY, "database password"))).toBe(
      HTTP_STATUS.BAD_GATEWAY,
    );
    expect(authClientErrorStatus(httpError(HTTP_STATUS.BAD_REQUEST, "Invalid OTP"))).toBe(
      HTTP_STATUS.BAD_REQUEST,
    );
  });
});
