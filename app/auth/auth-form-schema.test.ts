import { parseWithZod } from "@conform-to/zod/v4";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  EMAIL_INVALID_ERROR,
  loginFormSchema,
  OTP_CODE_ERROR,
  TERMS_ACCEPTANCE_ERROR,
  validReferralCode,
  verifyFormSchema,
} from "./auth-form-schema";

function firstFieldError<T>(error: z.ZodError<T>, field: keyof T & string) {
  return z.flattenError(error).fieldErrors[field]?.[0];
}

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
    });

    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }

    expect(firstFieldError(result.error, "acceptTerms")).toBe(TERMS_ACCEPTANCE_ERROR);
  });

  it("returns inline field errors for email and referral code", () => {
    const result = loginFormSchema.safeParse({
      email: "",
      referralCode: "NOPE",
      acceptTerms: "on",
    });

    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }

    const fields = z.flattenError(result.error).fieldErrors;

    expect(fields.email?.[0]).toBe(EMAIL_INVALID_ERROR);
    expect(fields.referralCode?.[0]).toBe("Referral code must be 8 characters");
    expect(fields.acceptTerms).toBeUndefined();
  });

  it("maps an unchecked terms checkbox from FormData", () => {
    const formData = new FormData();
    formData.set("email", "ada@tripdly.com");

    const submission = parseWithZod(formData, { schema: loginFormSchema });

    expect(submission.status).toBe("error");
    if (submission.status !== "error") {
      return;
    }

    expect(submission.error?.acceptTerms).toContain(TERMS_ACCEPTANCE_ERROR);
  });

  it("maps an empty email from FormData the way Conform submits it", () => {
    const formData = new FormData();
    formData.set("email", "");
    formData.set("acceptTerms", "on");

    const submission = parseWithZod(formData, { schema: loginFormSchema });

    expect(submission.status).toBe("error");
    if (submission.status !== "error") {
      return;
    }

    expect(submission.error?.email).toContain(EMAIL_INVALID_ERROR);
  });
});

describe("verifyFormSchema", () => {
  it("requires a 6-digit code", () => {
    expect(verifyFormSchema.parse({ code: "123456" })).toEqual({ code: "123456" });
    const invalid = verifyFormSchema.safeParse({ code: "12a456" });
    expect(invalid.success).toBe(false);
    if (invalid.success) {
      return;
    }

    expect(firstFieldError(invalid.error, "code")).toBe(OTP_CODE_ERROR);
  });
});

describe("validReferralCode", () => {
  it("keeps a matching code and drops anything else", () => {
    expect(validReferralCode(" abcd2345 ")).toBe("ABCD2345");
    expect(validReferralCode("nope")).toBe("");
    expect(validReferralCode(null)).toBe("");
  });
});
