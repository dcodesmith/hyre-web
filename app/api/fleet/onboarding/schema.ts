import { z } from "zod";

const documentStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED"]);
const accountTypeSchema = z.enum(["INDIVIDUAL", "BUSINESS"]);
const nameMatchSchema = z.enum(["MATCHED", "REVIEW_REQUIRED", "MISMATCHED"]);
const reviewedStepSchema = z.enum(["PENDING", "VERIFIED", "REVIEW_REQUIRED"]);

export const fleetOwnerBanksSchema = z.array(
  z.object({
    code: z.string(),
    name: z.string(),
  }),
);

export const fleetOwnerOnboardingSchema = z.object({
  status: z.enum(["ACTION_REQUIRED", "UNDER_REVIEW", "VERIFIED"]),
  accountType: accountTypeSchema.nullable(),
  isOwnerDriver: z.boolean().nullable(),
  emailVerified: z.boolean(),
  phone: z.object({
    number: z.string().nullable(),
    verified: z.boolean(),
  }),
  identity: z
    .object({
      status: z.enum(["SUCCEEDED", "REVIEW_REQUIRED"]),
      legalName: z.string().nullable(),
      businessName: z.string().nullable(),
    })
    .nullable(),
  bank: z
    .object({
      bankName: z.string(),
      accountName: z.string(),
      accountNumber: z.string(),
      verified: z.boolean(),
    })
    .nullable(),
  documents: z.object({
    driversLicense: documentStatusSchema.nullable(),
    lasdri: documentStatusSchema.nullable(),
  }),
  requiredActions: z.array(
    z.enum(["VERIFY_EMAIL", "VERIFY_PHONE", "VERIFY_ACCOUNT", "UPLOAD_DRIVERS_LICENSE"]),
  ),
  steps: z.object({
    contact: z.enum(["PENDING", "VERIFIED"]),
    identity: reviewedStepSchema,
    payout: reviewedStepSchema,
    driving: z.enum(["PENDING", "COMPLETED", "SKIPPED"]),
    submission: reviewedStepSchema,
  }),
  nextAction: z.enum([
    "VERIFY_EMAIL",
    "VERIFY_PHONE",
    "VERIFY_IDENTITY",
    "VERIFY_PAYOUT",
    "PROVIDE_DRIVING_CREDENTIALS",
    "SUBMIT_ACCOUNT",
    "WAIT_FOR_REVIEW",
    "COMPLETE",
  ]),
});

export const fleetOwnerPhoneVerificationSchema = z.object({
  status: z.enum(["PENDING", "VERIFIED"]),
  phoneNumber: z.string(),
});

export const fleetOwnerDriverLicenseReplacementSchema = z.object({
  status: z.literal("PENDING"),
});

export const fleetOwnerIdentityVerificationSchema = z.object({
  id: z.string(),
  status: z.enum(["VERIFIED", "REVIEW_REQUIRED"]),
  accountType: accountTypeSchema,
  legalName: z.string().nullable(),
  businessName: z.string().nullable(),
});

export const fleetOwnerPayoutVerificationSchema = z.object({
  status: z.enum(["VERIFIED", "REVIEW_REQUIRED"]),
  bank: z.object({
    bankName: z.string(),
    accountName: z.string(),
    accountNumber: z.string().nullable(),
    nameMatch: nameMatchSchema.nullable(),
  }),
});

export const fleetOwnerDrivingCredentialsSchema = z.object({
  status: z.literal("COMPLETED"),
  isOwnerDriver: z.boolean(),
  documents: z.object({
    driversLicense: documentStatusSchema.nullable(),
    lasdri: documentStatusSchema.nullable(),
  }),
});

export const fleetOwnerAccountVerificationSchema = z.object({
  id: z.string(),
  status: z.enum(["SUCCEEDED", "REVIEW_REQUIRED"]),
  accountType: accountTypeSchema,
  isOwnerDriver: z.boolean().nullable(),
  legalName: z.string().nullable(),
  businessName: z.string().nullable(),
  bank: z
    .object({
      bankName: z.string().nullable(),
      accountName: z.string(),
      accountNumber: z.string().nullable(),
      nameMatch: nameMatchSchema.nullable(),
    })
    .nullable(),
});

export type FleetOwnerBank = z.output<typeof fleetOwnerBanksSchema>[number];
export type FleetOwnerOnboarding = z.output<typeof fleetOwnerOnboardingSchema>;
