import { describe, expect, it } from "vitest";

import { loginFormSchema, verifyFormSchema } from "./auth-form-schema";

describe("loginFormSchema", () => {
  it("normalizes email and optional referral code", () => {
    expect(
      loginFormSchema.parse({
        email: "  Ada@Tripdly.com ",
        referralCode: "abcd2345",
        acceptTerms: "on",
      }),
    ).toEqual({
      email: "ada@tripdly.com",
      referralCode: "ABCD2345",
      acceptTerms: "on",
    });
  });

  it("rejects a missing terms acceptance", () => {
    const result = loginFormSchema.safeParse({
      email: "ada@tripdly.com",
      referralCode: "",
      acceptTerms: "",
    });

    expect(result.success).toBe(false);
  });
});

describe("verifyFormSchema", () => {
  it("requires a 6-digit code", () => {
    expect(verifyFormSchema.parse({ code: "123456" })).toEqual({ code: "123456" });
    expect(verifyFormSchema.safeParse({ code: "12a456" }).success).toBe(false);
  });
});
