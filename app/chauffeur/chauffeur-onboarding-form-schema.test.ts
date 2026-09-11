import { describe, expect, it } from "vitest";

import {
  chauffeurConsentFormSchema,
  chauffeurDrivingFormSchema,
  chauffeurNinFormSchema,
  chauffeurPhoneCodeFormSchema,
} from "./chauffeur-onboarding-form-schema";

const IDEMPOTENCY_KEY = "18aa029c-4bb1-4ca7-b25e-cfc802c4bf8c";

function selfieFile(name = "selfie.jpg", type = "image/jpeg", size = 1024) {
  return new File([new Uint8Array(size)], name, { type });
}

describe("chauffeur onboarding form schemas", () => {
  it("requires both consent checkboxes", () => {
    expect(
      chauffeurConsentFormSchema.parse({ termsAccepted: "on", privacyAccepted: "on" }),
    ).toEqual({ termsAccepted: "on", privacyAccepted: "on" });
    expect(chauffeurConsentFormSchema.safeParse({ termsAccepted: "on" }).success).toBe(false);

    const parsed = chauffeurConsentFormSchema.safeParse({ privacyAccepted: "on" });
    expect(parsed.success).toBe(false);
    if (parsed.success) {
      return;
    }
    expect(parsed.error.issues.find((issue) => issue.path[0] === "termsAccepted")?.message).toBe(
      "Accept the terms to continue",
    );
  });

  it("accepts a 4-10 digit verification code", () => {
    expect(chauffeurPhoneCodeFormSchema.parse({ code: "1234" })).toEqual({ code: "1234" });
    expect(chauffeurPhoneCodeFormSchema.parse({ code: "1234567890" }).code).toBe("1234567890");
    expect(chauffeurPhoneCodeFormSchema.safeParse({ code: "123" }).success).toBe(false);
    expect(chauffeurPhoneCodeFormSchema.safeParse({ code: "12a456" }).success).toBe(false);
  });

  it("requires an 11-digit NIN and a UUID idempotency key", () => {
    expect(
      chauffeurNinFormSchema.parse({ nin: "12345678901", idempotencyKey: IDEMPOTENCY_KEY }),
    ).toEqual({
      nin: "12345678901",
      idempotencyKey: IDEMPOTENCY_KEY,
    });
    expect(
      chauffeurNinFormSchema.parse({ nin: " 12345678901 ", idempotencyKey: IDEMPOTENCY_KEY }).nin,
    ).toBe("12345678901");
    expect(
      chauffeurNinFormSchema.safeParse({ nin: "1234567890", idempotencyKey: IDEMPOTENCY_KEY })
        .success,
    ).toBe(false);

    const parsed = chauffeurNinFormSchema.safeParse({ idempotencyKey: IDEMPOTENCY_KEY });
    expect(parsed.success).toBe(false);
    if (parsed.success) {
      return;
    }
    expect(parsed.error.issues.find((issue) => issue.path[0] === "nin")?.message).toBe(
      "NIN is required",
    );
  });

  it.each([
    ["selfie.jpg", "image/jpeg"],
    ["selfie.png", "image/png"],
    ["selfie.webp", "image/webp"],
  ] as const)("accepts driving credentials with a %s selfie", (name, type) => {
    const selfie = selfieFile(name, type);

    expect(
      chauffeurDrivingFormSchema.parse({
        driversLicenseNumber: "ABC-12345",
        selfie,
        idempotencyKey: IDEMPOTENCY_KEY,
      }),
    ).toMatchObject({ driversLicenseNumber: "ABC-12345", selfie, idempotencyKey: IDEMPOTENCY_KEY });
  });

  it("rejects an invalid licence, empty selfie, wrong type, or oversized image", () => {
    const valid = {
      driversLicenseNumber: "ABC-12345",
      selfie: selfieFile(),
      idempotencyKey: IDEMPOTENCY_KEY,
    };

    expect(
      chauffeurDrivingFormSchema.safeParse({ ...valid, driversLicenseNumber: "ab" }).success,
    ).toBe(false);
    expect(
      chauffeurDrivingFormSchema.safeParse({
        ...valid,
        selfie: selfieFile("selfie.jpg", "image/jpeg", 0),
      }).success,
    ).toBe(false);
    expect(
      chauffeurDrivingFormSchema.safeParse({
        ...valid,
        selfie: selfieFile("selfie.gif", "image/gif"),
      }).success,
    ).toBe(false);
    expect(
      chauffeurDrivingFormSchema.safeParse({
        ...valid,
        selfie: selfieFile("selfie.jpg", "image/jpeg", 5 * 1024 * 1024 + 1),
      }).success,
    ).toBe(false);
  });
});
