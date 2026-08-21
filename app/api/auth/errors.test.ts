import { describe, expect, it } from "vitest";

import { ApiRequestError } from "../api.server";
import { authClientErrorMessage } from "./errors";

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
      authClientErrorMessage(httpError(403, 'Role "admin" is not allowed from this client')),
    ).toBe("We couldn't start the login process. Please check your details and try again.");
  });

  it("surfaces invalid OTP and retry-after", () => {
    expect(authClientErrorMessage(httpError(400, "Invalid OTP"))).toBe("Invalid OTP");
    expect(
      authClientErrorMessage(
        httpError(429, "Too many requests", new Headers({ "x-retry-after": "30" })),
      ),
    ).toBe("Too many attempts. Try again in 30 seconds.");
  });

  it("does not leak 5xx details", () => {
    expect(authClientErrorMessage(httpError(502, "database password"))).toBe(
      "Something went wrong. Please try again.",
    );
  });
});
