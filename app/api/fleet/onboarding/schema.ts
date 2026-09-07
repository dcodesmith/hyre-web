import { z } from "zod";

const documentStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED"]);
const accountTypeSchema = z.enum(["INDIVIDUAL", "BUSINESS"]);
const verificationStatusSchema = z.enum(["PROCESSING", "SUCCEEDED", "REVIEW_REQUIRED", "FAILED"]);

export const fleetOwnerBanksSchema = z.array(
  z.object({
    code: z.string(),
    name: z.string(),
  }),
);

export const fleetOwnerOnboardingSchema = z.object({
  status: z.enum(["ACTION_REQUIRED", "UNDER_REVIEW", "VERIFIED"]),
  accountType: accountTypeSchema.nullable(),
  isOwnerDriver: z.boolean(),
  emailVerified: z.boolean(),
  phone: z.object({
    number: z.string().nullable(),
    verified: z.boolean(),
  }),
  identity: z
    .object({
      status: verificationStatusSchema,
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
});

export const fleetOwnerPhoneVerificationSchema = z.object({
  status: z.enum(["PENDING", "VERIFIED"]),
  phoneNumber: z.string(),
});

export const fleetOwnerDriverLicenseReplacementSchema = z.object({
  status: z.literal("PENDING"),
});

export const fleetOwnerAccountVerificationSchema = z.object({
  id: z.string(),
  status: z.enum(["SUCCEEDED", "REVIEW_REQUIRED"]),
  accountType: accountTypeSchema,
  isOwnerDriver: z.boolean(),
  legalName: z.string().nullable(),
  businessName: z.string().nullable(),
  bank: z
    .object({
      bankName: z.string().nullable(),
      accountName: z.string(),
      accountNumber: z.string().nullable(),
      nameMatch: z.enum(["MATCHED", "REVIEW_REQUIRED", "MISMATCHED"]).nullable(),
    })
    .nullable(),
});

export type FleetOwnerBank = z.output<typeof fleetOwnerBanksSchema>[number];
export type FleetOwnerOnboarding = z.output<typeof fleetOwnerOnboardingSchema>;
