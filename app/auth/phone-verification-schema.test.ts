import { describe, expect, it } from "vitest";

import {
  phoneVerificationCheckSchema,
  phoneVerificationSendSchema,
} from "./phone-verification-schema";

describe("phone verification schemas", () => {
  it("accepts a trimmed E.164 number and rejects local or short numbers", () => {
    expect(phoneVerificationSendSchema.parse({ phoneNumber: " +2348012345678 " })).toEqual({
      phoneNumber: "+2348012345678",
    });
    expect(phoneVerificationSendSchema.safeParse({ phoneNumber: "08012345678" }).success).toBe(
      false,
    );
    expect(phoneVerificationSendSchema.safeParse({ phoneNumber: "+1234567" }).success).toBe(false);
    expect(phoneVerificationSendSchema.safeParse({ phoneNumber: "" }).success).toBe(false);
  });

  it("accepts a 4-10 digit code and rejects anything else", () => {
    expect(
      phoneVerificationCheckSchema.parse({ phoneNumber: "+2348012345678", code: " 1234 " }),
    ).toEqual({ phoneNumber: "+2348012345678", code: "1234" });
    expect(
      phoneVerificationCheckSchema.parse({
        phoneNumber: "+2348012345678",
        code: "1234567890",
      }).code,
    ).toBe("1234567890");
    expect(
      phoneVerificationCheckSchema.safeParse({ phoneNumber: "+2348012345678", code: "123" })
        .success,
    ).toBe(false);
    expect(
      phoneVerificationCheckSchema.safeParse({
        phoneNumber: "+2348012345678",
        code: "12345678901",
      }).success,
    ).toBe(false);
    expect(
      phoneVerificationCheckSchema.safeParse({ phoneNumber: "+2348012345678", code: "12a456" })
        .success,
    ).toBe(false);
  });
});
