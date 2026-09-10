import { describe, expect, it } from "vitest";

import {
  onboardingDriverLicenseReplacementFormSchema,
  onboardingDrivingFormSchema,
  onboardingIdentityFormSchema,
  onboardingPayoutFormSchema,
  onboardingPhoneCheckFormSchema,
  onboardingPhoneFormSchema,
} from "./onboarding-form-schema";

const individualIdentity = {
  accountType: "INDIVIDUAL",
  nin: "12345678901",
} as const;

const businessIdentity = {
  accountType: "BUSINESS",
  nin: "12345678901",
  businessName: "Hyre Mobility Limited",
  registrationNumber: "RC123456",
  registrationType: "RC",
} as const;

const payout = {
  bankCode: "058",
  accountNumber: "0123456789",
} as const;

function documentFile(name = "license.pdf", type = "application/pdf", size = 1024) {
  return new File([new Uint8Array(size)], name, { type });
}

describe("onboarding form schemas", () => {
  it("accepts E.164 phone numbers and rejects local formats", () => {
    expect(onboardingPhoneFormSchema.parse({ phoneNumber: "+2348012345678" })).toEqual({
      phoneNumber: "+2348012345678",
    });
    expect(onboardingPhoneFormSchema.safeParse({ phoneNumber: "08012345678" }).success).toBe(false);
  });

  it("accepts a 4-10 digit OTP with the phone number", () => {
    expect(
      onboardingPhoneCheckFormSchema.parse({
        phoneNumber: "+2348012345678",
        code: "1234",
      }),
    ).toEqual({ phoneNumber: "+2348012345678", code: "1234" });
    expect(
      onboardingPhoneCheckFormSchema.parse({
        phoneNumber: "+2348012345678",
        code: "1234567890",
      }).code,
    ).toBe("1234567890");
    expect(
      onboardingPhoneCheckFormSchema.safeParse({
        phoneNumber: "+2348012345678",
        code: "123",
      }).success,
    ).toBe(false);
    expect(
      onboardingPhoneCheckFormSchema.safeParse({
        phoneNumber: "+2348012345678",
        code: "12345678901",
      }).success,
    ).toBe(false);
    expect(
      onboardingPhoneCheckFormSchema.safeParse({
        phoneNumber: "+2348012345678",
        code: "12a456",
      }).success,
    ).toBe(false);
  });

  it("requires business fields only for business identity", () => {
    expect(onboardingIdentityFormSchema.parse(individualIdentity)).toEqual(individualIdentity);
    expect(onboardingIdentityFormSchema.parse(businessIdentity)).toEqual(businessIdentity);
    expect(
      onboardingIdentityFormSchema.safeParse({
        ...individualIdentity,
        accountType: "BUSINESS",
      }).success,
    ).toBe(false);
    expect(
      onboardingIdentityFormSchema.safeParse({
        ...individualIdentity,
        businessName: "Ignored for individuals",
      }).success,
    ).toBe(true);
  });

  it("requires an 11-digit NIN", () => {
    expect(onboardingIdentityFormSchema.parse(individualIdentity).nin).toBe("12345678901");
    expect(
      onboardingIdentityFormSchema.safeParse({ ...individualIdentity, nin: "1234567890" }).success,
    ).toBe(false);
  });

  it.each([["nin", { ...individualIdentity, nin: undefined }, "NIN is required"]] as const)(
    "uses a useful required message for identity %s",
    (field, input, message) => {
      const parsed = onboardingIdentityFormSchema.safeParse(input);
      expect(parsed.success).toBe(false);
      if (parsed.success) return;

      expect(parsed.error.issues.find((issue) => issue.path[0] === field)?.message).toBe(message);
    },
  );

  it.each([
    ["businessName", { ...businessIdentity, businessName: undefined }, "Business name is required"],
    [
      "registrationNumber",
      { ...businessIdentity, registrationNumber: undefined },
      "Registration number is required",
    ],
    [
      "registrationType",
      { ...businessIdentity, registrationType: undefined },
      "Select a registration type",
    ],
  ] as const)("uses a useful business required message for %s", (field, input, message) => {
    const parsed = onboardingIdentityFormSchema.safeParse(input);
    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    expect(parsed.error.issues.find((issue) => issue.path[0] === field)?.message).toBe(message);
  });

  it("requires a selected bank and a 10-digit account number", () => {
    expect(onboardingPayoutFormSchema.parse(payout)).toEqual(payout);
    expect(onboardingPayoutFormSchema.parse({ ...payout, bankName: "GTBank" })).toEqual(payout);
    expect(
      onboardingPayoutFormSchema.safeParse({ ...payout, accountNumber: "012345678" }).success,
    ).toBe(false);
    expect(onboardingPayoutFormSchema.safeParse({ ...payout, bankCode: "" }).success).toBe(false);
  });

  it.each([
    ["bankCode", { ...payout, bankCode: undefined }, "Select a bank"],
    ["accountNumber", { ...payout, accountNumber: undefined }, "Account number is required"],
  ] as const)("uses a useful required message for payout %s", (field, input, message) => {
    const parsed = onboardingPayoutFormSchema.safeParse(input);
    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    expect(parsed.error.issues.find((issue) => issue.path[0] === field)?.message).toBe(message);
  });

  it("requires a drivers license for owner-drivers and allows optional LASDRI", () => {
    const driversLicense = documentFile();
    const lasdri = documentFile("lasdri.jpg", "image/jpeg");

    expect(onboardingDrivingFormSchema.parse({ isOwnerDriver: "false" })).toMatchObject({
      isOwnerDriver: false,
    });
    expect(onboardingDrivingFormSchema.safeParse({ isOwnerDriver: "true" }).success).toBe(false);
    expect(
      onboardingDrivingFormSchema.parse({
        isOwnerDriver: "true",
        driversLicense,
      }),
    ).toMatchObject({ isOwnerDriver: true, driversLicense });
    expect(
      onboardingDrivingFormSchema.parse({
        isOwnerDriver: "true",
        driversLicense,
        lasdri,
      }),
    ).toMatchObject({ isOwnerDriver: true, driversLicense, lasdri });
  });

  it.each([
    ["license.jpg", "image/jpeg"],
    ["license.png", "image/png"],
    ["license.webp", "image/webp"],
    ["license.pdf", "application/pdf"],
  ] as const)("accepts owner-driver %s documents", (name, type) => {
    const driversLicense = documentFile(name, type);

    expect(
      onboardingDrivingFormSchema.parse({
        isOwnerDriver: "true",
        driversLicense,
      }).driversLicense,
    ).toBe(driversLicense);
  });

  it("rejects owner-driver documents that are the wrong type or larger than 5MB", () => {
    expect(
      onboardingDrivingFormSchema.safeParse({
        isOwnerDriver: "true",
        driversLicense: documentFile("license.gif", "image/gif"),
      }).success,
    ).toBe(false);
    expect(
      onboardingDrivingFormSchema.safeParse({
        isOwnerDriver: "true",
        driversLicense: documentFile("license.pdf", "application/pdf", 5 * 1024 * 1024 + 1),
      }).success,
    ).toBe(false);
  });

  it("rejects driver documents when the owner is not an owner-driver", () => {
    expect(
      onboardingDrivingFormSchema.safeParse({
        isOwnerDriver: "false",
        driversLicense: documentFile(),
      }).success,
    ).toBe(false);
    expect(
      onboardingDrivingFormSchema.safeParse({
        isOwnerDriver: "false",
        lasdri: documentFile("lasdri.pdf"),
      }).success,
    ).toBe(false);
  });
});

describe("onboarding driver-licence replacement form schema", () => {
  function firstIssue(value: unknown) {
    const parsed = onboardingDriverLicenseReplacementFormSchema.safeParse(value);
    if (parsed.success) {
      throw new Error("expected invalid input");
    }
    return parsed.error.issues[0]?.message ?? "";
  }

  function drivingDocumentIssue(file: File) {
    const parsed = onboardingDrivingFormSchema.safeParse({
      isOwnerDriver: "true",
      driversLicense: file,
    });
    if (parsed.success) {
      throw new Error("expected invalid driving document");
    }
    return parsed.error.issues[0]?.message ?? "";
  }

  it.each([
    ["license.jpg", "image/jpeg"],
    ["license.png", "image/png"],
    ["license.webp", "image/webp"],
    ["license.pdf", "application/pdf"],
  ] as const)("accepts replacement %s documents", (name, type) => {
    const file = documentFile(name, type);

    expect(onboardingDriverLicenseReplacementFormSchema.parse({ file })).toEqual({ file });
  });

  it("requires a replacement file", () => {
    expect(firstIssue({})).toBe("Upload a replacement driver's licence");
    expect(onboardingDriverLicenseReplacementFormSchema.safeParse({}).success).toBe(false);
    expect(
      onboardingDriverLicenseReplacementFormSchema.safeParse({
        file: documentFile("license.pdf", "application/pdf", 0),
      }).success,
    ).toBe(false);
  });

  it("uses the same driving-document MIME and 5MB rules", () => {
    const gif = documentFile("license.gif", "image/gif");
    const oversized = documentFile("license.pdf", "application/pdf", 5 * 1024 * 1024 + 1);
    const empty = documentFile("license.pdf", "application/pdf", 0);

    expect(firstIssue({ file: gif })).toBe(drivingDocumentIssue(gif));
    expect(firstIssue({ file: oversized })).toBe(drivingDocumentIssue(oversized));
    expect(firstIssue({ file: empty })).toBe(drivingDocumentIssue(empty));
    expect(firstIssue({ file: gif })).toBe("Use a JPEG, PNG, WebP, or PDF file");
    expect(firstIssue({ file: oversized })).toBe("File must not exceed 5 MB");
    expect(firstIssue({ file: empty })).toBe("The selected file is empty");
  });
});
