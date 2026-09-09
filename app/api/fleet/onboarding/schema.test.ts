import { describe, expect, it } from "vitest";

import {
  fleetOwnerAccountVerificationSchema,
  fleetOwnerBanksSchema,
  fleetOwnerDriverLicenseReplacementSchema,
  fleetOwnerDrivingCredentialsSchema,
  fleetOwnerIdentityVerificationSchema,
  fleetOwnerOnboardingSchema,
  fleetOwnerPayoutVerificationSchema,
  fleetOwnerPhoneVerificationSchema,
} from "./schema";

const banks = [
  { code: "044", name: "Access Bank" },
  { code: "058", name: "GTBank" },
] as const;

const pendingSteps = {
  contact: "PENDING",
  identity: "PENDING",
  payout: "PENDING",
  driving: "PENDING",
  submission: "PENDING",
} as const;

const actionRequiredOnboarding = {
  status: "ACTION_REQUIRED",
  accountType: null,
  isOwnerDriver: null,
  emailVerified: false,
  phone: { number: "**********5678", verified: false },
  identity: null,
  bank: null,
  documents: { driversLicense: null, lasdri: null },
  requiredActions: ["VERIFY_EMAIL", "VERIFY_PHONE", "VERIFY_ACCOUNT"],
  steps: pendingSteps,
  nextAction: "VERIFY_EMAIL",
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
  steps: {
    contact: "VERIFIED",
    identity: "REVIEW_REQUIRED",
    payout: "VERIFIED",
    driving: "SKIPPED",
    submission: "REVIEW_REQUIRED",
  },
  nextAction: "WAIT_FOR_REVIEW",
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
  steps: {
    contact: "VERIFIED",
    identity: "VERIFIED",
    payout: "VERIFIED",
    driving: "COMPLETED",
    submission: "VERIFIED",
  },
  nextAction: "COMPLETE",
} as const;

describe("fleet-owner onboarding API schemas", () => {
  it("parses the normalized bank list contract", () => {
    expect(fleetOwnerBanksSchema.parse(banks)).toEqual(banks);
    expect(fleetOwnerBanksSchema.safeParse([{ name: "GTBank" }]).success).toBe(false);
  });

  it("parses ACTION_REQUIRED, UNDER_REVIEW, and VERIFIED onboarding with steps and nextAction", () => {
    expect(fleetOwnerOnboardingSchema.parse(actionRequiredOnboarding)).toEqual(
      actionRequiredOnboarding,
    );
    expect(fleetOwnerOnboardingSchema.parse(underReviewOnboarding)).toMatchObject({
      status: "UNDER_REVIEW",
      isOwnerDriver: false,
      phone: { number: "**********5678", verified: true },
      identity: { status: "REVIEW_REQUIRED", legalName: "JOHN MIDDLE DOE", businessName: null },
      bank: { accountNumber: "******6789", verified: false },
      documents: { driversLicense: null, lasdri: null },
      requiredActions: [],
      steps: {
        contact: "VERIFIED",
        identity: "REVIEW_REQUIRED",
        payout: "VERIFIED",
        driving: "SKIPPED",
        submission: "REVIEW_REQUIRED",
      },
      nextAction: "WAIT_FOR_REVIEW",
    });
    expect(fleetOwnerOnboardingSchema.parse(verifiedOnboarding)).toMatchObject({
      status: "VERIFIED",
      documents: { driversLicense: "APPROVED", lasdri: "PENDING" },
      requiredActions: [],
      steps: {
        contact: "VERIFIED",
        identity: "VERIFIED",
        payout: "VERIFIED",
        driving: "COMPLETED",
        submission: "VERIFIED",
      },
      nextAction: "COMPLETE",
    });
  });

  it("rejects onboarding without nextAction", () => {
    const { nextAction: _nextAction, ...withoutNextAction } = actionRequiredOnboarding;
    expect(fleetOwnerOnboardingSchema.safeParse(withoutNextAction).success).toBe(false);
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

  it("parses identity, payout, and driving stage responses", () => {
    expect(
      fleetOwnerIdentityVerificationSchema.parse({
        id: "id-1",
        status: "VERIFIED",
        accountType: "INDIVIDUAL",
        legalName: "JOHN MIDDLE DOE",
        businessName: null,
      }),
    ).toMatchObject({ status: "VERIFIED", accountType: "INDIVIDUAL", businessName: null });
    expect(
      fleetOwnerPayoutVerificationSchema.parse({
        status: "REVIEW_REQUIRED",
        bank: {
          bankName: "GTBank",
          accountName: "JOHN DOE",
          accountNumber: "******6789",
          nameMatch: "REVIEW_REQUIRED",
        },
      }),
    ).toMatchObject({
      status: "REVIEW_REQUIRED",
      bank: { accountNumber: "******6789", nameMatch: "REVIEW_REQUIRED" },
    });
    expect(
      fleetOwnerDrivingCredentialsSchema.parse({
        status: "COMPLETED",
        isOwnerDriver: false,
        documents: { driversLicense: null, lasdri: null },
      }),
    ).toEqual({
      status: "COMPLETED",
      isOwnerDriver: false,
      documents: { driversLicense: null, lasdri: null },
    });
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
