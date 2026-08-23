import { describe, expect, it } from "vitest";

import { normalizeProblemDetails } from "./problem-details";

const fallback = {
  status: 400,
  title: "Bad Request",
  detail: "Bad Request",
  instance: "/api/auth/sign-in/email-otp",
};

describe("normalizeProblemDetails", () => {
  it("keeps Better Auth 4xx message and code", () => {
    expect(
      normalizeProblemDetails({ code: "INVALID_OTP", message: "Invalid OTP" }, fallback),
    ).toEqual({
      type: "BETTER_AUTH_ERROR",
      title: "INVALID_OTP",
      status: 400,
      detail: "Invalid OTP",
      instance: "/api/auth/sign-in/email-otp",
      errorCode: "INVALID_OTP",
    });
  });

  it("does not treat Better Auth bodies as public details on 5xx", () => {
    expect(
      normalizeProblemDetails(
        { message: "secret" },
        { ...fallback, status: 500, title: "Error", detail: "Error" },
      ),
    ).toMatchObject({
      type: "UPSTREAM_HTTP_ERROR",
      detail: "The upstream API returned an error.",
      status: 500,
    });
  });
});
