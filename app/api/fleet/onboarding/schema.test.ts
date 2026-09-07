import { describe, expect, it } from "vitest";

import {
  fleetOwnerAccountVerificationSchema,
  fleetOwnerBanksSchema,
  fleetOwnerDriverLicenseReplacementSchema,
  fleetOwnerOnboardingSchema,
  fleetOwnerPhoneVerificationSchema,
} from "./schema";

const banks = [
  { code: "044", name: "Access Bank" },
  { code: "058", name: "GTBank" },
] as const;

const actionRequiredOnboarding = {
  status: "ACTION_REQUIRED",
  accountType: null,
  isOwnerDriver: false,
  emailVerified: false,
  phone: { number: "**********5678", verified: false },
  identity: null,
  bank: null,
  documents: { driversLicense: null, lasdri: null },
  requiredActions: ["VERIFY_EMAIL", "VERIFY_PHONE", "VERIFY_ACCOUNT"],
} as const;

const underReviewOnboarding = {
  status: "UNDER_REVIEW",
  accountType: "INDIVIDUAL",
  isOwnerDriver: false,
  emailVerified: true,
  phone: { number: "**********5678", verified: true },
  identity: {
    status: "REVIEW_REQUIRED",
    legalName: "JOHN MIDDLE DOE",
    businessName: null,
  },
  bank: {
    bankName: "GTBank",
    accountName: "JOHN DOE",
    accountNumber: "******6789",
    verified: false,
  },
  documents: { driversLicense: null, lasdri: null },
  requiredActions: [],
} as const;

const verifiedOnboarding = {
  status: "VERIFIED",
  accountType: "INDIVIDUAL",
  isOwnerDriver: true,
  emailVerified: true,
  phone: { number: "**********5678", verified: true },
  identity: {
    status: "SUCCEEDED",
    legalName: "JOHN MIDDLE DOE",
    businessName: null,
  },
  bank: {
    bankName: "GTBank",
    accountName: "JOHN DOE",
    accountNumber: "******6789",
    verified: true,
  },
  documents: { driversLicense: "APPROVED", lasdri: "PENDING" },
  requiredActions: [],
} as const;

describe("fleet-owner onboarding API schemas", () => {
  it("parses the normalized bank list contract", () => {
    expect(fleetOwnerBanksSchema.parse(banks)).toEqual(banks);
    expect(fleetOwnerBanksSchema.safeParse([{ name: "GTBank" }]).success).toBe(false);
  });

  it("parses ACTION_REQUIRED, UNDER_REVIEW, and VERIFIED onboarding statuses", () => {
    expect(fleetOwnerOnboardingSchema.parse(actionRequiredOnboarding)).toEqual(
      actionRequiredOnboarding,
    );
    expect(fleetOwnerOnboardingSchema.parse(underReviewOnboarding)).toMatchObject({
      status: "UNDER_REVIEW",
      phone: { number: "**********5678", verified: true },
      identity: { status: "REVIEW_REQUIRED", legalName: "JOHN MIDDLE DOE", businessName: null },
      bank: { accountNumber: "******6789", verified: false },
      documents: { driversLicense: null, lasdri: null },
      requiredActions: [],
    });
    expect(fleetOwnerOnboardingSchema.parse(verifiedOnboarding)).toMatchObject({
      status: "VERIFIED",
      documents: { driversLicense: "APPROVED", lasdri: "PENDING" },
      requiredActions: [],
    });
  });

  it("rejects an unknown onboarding status", () => {
    expect(
      fleetOwnerOnboardingSchema.safeParse({
        ...actionRequiredOnboarding,
        status: "PROCESSING",
      }).success,
    ).toBe(false);
  });

  it("parses masked PENDING and VERIFIED phone verification responses", () => {
    expect(
      fleetOwnerPhoneVerificationSchema.parse({
        status: "PENDING",
        phoneNumber: "**********1111",
      }),
    ).toEqual({ status: "PENDING", phoneNumber: "**********1111" });
    expect(
      fleetOwnerPhoneVerificationSchema.parse({
        status: "VERIFIED",
        phoneNumber: "**********5678",
      }),
    ).toEqual({ status: "VERIFIED", phoneNumber: "**********5678" });
    expect(
      fleetOwnerPhoneVerificationSchema.safeParse({
        status: "pending",
        phoneNumber: "**********1111",
      }).success,
    ).toBe(false);
  });

  it("parses SUCCEEDED and REVIEW_REQUIRED account verification responses", () => {
    expect(
      fleetOwnerAccountVerificationSchema.parse({
        id: "ver-1",
        status: "SUCCEEDED",
        accountType: "INDIVIDUAL",
        isOwnerDriver: false,
        legalName: "JOHN MIDDLE DOE",
        businessName: null,
        bank: {
          bankName: "GTBank",
          accountName: "JOHN DOE",
          accountNumber: "******6789",
          nameMatch: "MATCHED",
        },
      }),
    ).toMatchObject({
      status: "SUCCEEDED",
      accountType: "INDIVIDUAL",
      bank: { accountNumber: "******6789", nameMatch: "MATCHED" },
    });
    expect(
      fleetOwnerAccountVerificationSchema.parse({
        id: "ver-2",
        status: "REVIEW_REQUIRED",
        accountType: "BUSINESS",
        isOwnerDriver: true,
        legalName: "JOHN MIDDLE DOE",
        businessName: "HYRE MOBILITY LTD",
        bank: {
          bankName: "GTBank",
          accountName: "HYRE MOBILITY LIMITED",
          accountNumber: "******6789",
          nameMatch: "REVIEW_REQUIRED",
        },
      }),
    ).toMatchObject({
      status: "REVIEW_REQUIRED",
      accountType: "BUSINESS",
      isOwnerDriver: true,
      businessName: "HYRE MOBILITY LTD",
    });
    expect(
      fleetOwnerAccountVerificationSchema.safeParse({
        id: "ver-3",
        status: "FAILED",
        accountType: "INDIVIDUAL",
        isOwnerDriver: false,
        legalName: "JOHN MIDDLE DOE",
        businessName: null,
        bank: null,
      }).success,
    ).toBe(false);
  });

  it("parses a PENDING driver-licence replacement", () => {
    expect(fleetOwnerDriverLicenseReplacementSchema.parse({ status: "PENDING" })).toEqual({
      status: "PENDING",
    });
    expect(fleetOwnerDriverLicenseReplacementSchema.safeParse({}).success).toBe(false);
    expect(fleetOwnerDriverLicenseReplacementSchema.safeParse({ status: "APPROVED" }).success).toBe(
      false,
    );
  });
});
