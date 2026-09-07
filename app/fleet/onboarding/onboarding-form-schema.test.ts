import { describe, expect, it } from "vitest";

import {
  onboardingAccountFormSchema,
  onboardingDriverLicenseReplacementFormSchema,
  onboardingPhoneCheckFormSchema,
  onboardingPhoneFormSchema,
} from "./onboarding-form-schema";

const individualAccount = {
  accountType: "INDIVIDUAL",
  nin: "12345678901",
  isOwnerDriver: "false",
  bankName: "GTBank",
  bankCode: "058",
  accountNumber: "0123456789",
};

const businessAccount = {
  ...individualAccount,
  accountType: "BUSINESS",
  businessName: "Hyre Mobility Limited",
  registrationNumber: "RC123456",
  registrationType: "RC",
};

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

  it("requires business fields only for business accounts", () => {
    expect(onboardingAccountFormSchema.parse(individualAccount)).toMatchObject({
      accountType: "INDIVIDUAL",
      isOwnerDriver: false,
    });
    expect(onboardingAccountFormSchema.parse(businessAccount)).toMatchObject({
      accountType: "BUSINESS",
      businessName: "Hyre Mobility Limited",
      registrationNumber: "RC123456",
      registrationType: "RC",
    });
    expect(
      onboardingAccountFormSchema.safeParse({
        ...individualAccount,
        accountType: "BUSINESS",
      }).success,
    ).toBe(false);
  });

  it("requires an 11-digit NIN, 10-digit account, and selected bank code/name", () => {
    expect(onboardingAccountFormSchema.parse(individualAccount)).toMatchObject({
      nin: "12345678901",
      accountNumber: "0123456789",
      bankCode: "058",
      bankName: "GTBank",
    });
    expect(
      onboardingAccountFormSchema.safeParse({ ...individualAccount, nin: "1234567890" }).success,
    ).toBe(false);
    expect(
      onboardingAccountFormSchema.safeParse({ ...individualAccount, accountNumber: "012345678" })
        .success,
    ).toBe(false);
    expect(
      onboardingAccountFormSchema.safeParse({ ...individualAccount, bankCode: "" }).success,
    ).toBe(false);
    expect(
      onboardingAccountFormSchema.safeParse({ ...individualAccount, bankName: "" }).success,
    ).toBe(false);
  });

  it("requires a drivers license for owner-drivers and allows optional LASDRI", () => {
    const driversLicense = documentFile();
    const lasdri = documentFile("lasdri.jpg", "image/jpeg");

    expect(
      onboardingAccountFormSchema.safeParse({
        ...individualAccount,
        isOwnerDriver: "true",
      }).success,
    ).toBe(false);
    expect(
      onboardingAccountFormSchema.parse({
        ...individualAccount,
        isOwnerDriver: "true",
        driversLicense,
      }),
    ).toMatchObject({ isOwnerDriver: true, driversLicense });
    expect(
      onboardingAccountFormSchema.parse({
        ...individualAccount,
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
      onboardingAccountFormSchema.parse({
        ...individualAccount,
        isOwnerDriver: "true",
        driversLicense,
      }).driversLicense,
    ).toBe(driversLicense);
  });

  it("rejects owner-driver documents that are the wrong type or larger than 5MB", () => {
    expect(
      onboardingAccountFormSchema.safeParse({
        ...individualAccount,
        isOwnerDriver: "true",
        driversLicense: documentFile("license.gif", "image/gif"),
      }).success,
    ).toBe(false);
    expect(
      onboardingAccountFormSchema.safeParse({
        ...individualAccount,
        isOwnerDriver: "true",
        driversLicense: documentFile("license.pdf", "application/pdf", 5 * 1024 * 1024 + 1),
      }).success,
    ).toBe(false);
  });

  it("rejects driver documents when the owner is not an owner-driver", () => {
    expect(
      onboardingAccountFormSchema.safeParse({
        ...individualAccount,
        driversLicense: documentFile(),
      }).success,
    ).toBe(false);
    expect(
      onboardingAccountFormSchema.safeParse({
        ...individualAccount,
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

  function accountDocumentIssue(file: File) {
    const parsed = onboardingAccountFormSchema.safeParse({
      ...individualAccount,
      isOwnerDriver: "true",
      driversLicense: file,
    });
    if (parsed.success) {
      throw new Error("expected invalid account document");
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
    expect(onboardingDriverLicenseReplacementFormSchema.safeParse({}).success).toBe(false);
    expect(
      onboardingDriverLicenseReplacementFormSchema.safeParse({
        file: documentFile("license.pdf", "application/pdf", 0),
      }).success,
    ).toBe(false);
  });

  it("uses the same account-document MIME and 5MB rules", () => {
    const gif = documentFile("license.gif", "image/gif");
    const oversized = documentFile("license.pdf", "application/pdf", 5 * 1024 * 1024 + 1);
    const empty = documentFile("license.pdf", "application/pdf", 0);

    expect(firstIssue({ file: gif })).toBe(accountDocumentIssue(gif));
    expect(firstIssue({ file: oversized })).toBe(accountDocumentIssue(oversized));
    expect(firstIssue({ file: empty })).toBe(accountDocumentIssue(empty));
    expect(firstIssue({ file: gif })).toBe("Use a JPEG, PNG, WebP, or PDF file");
    expect(firstIssue({ file: oversized })).toBe("File must not exceed 5 MB");
  });
});
