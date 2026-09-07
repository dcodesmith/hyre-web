import type { SubmissionResult } from "@conform-to/react";
import { z } from "zod";

const MAX_DOCUMENT_SIZE_BYTES = 5 * 1024 * 1024;
const DOCUMENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

const phoneNumberSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/, "Enter a phone number in international format");

const optionalDocumentSchema = z.file().optional();

export const onboardingPhoneFormSchema = z.object({
  phoneNumber: phoneNumberSchema,
});

export const onboardingPhoneCheckFormSchema = onboardingPhoneFormSchema.extend({
  code: z
    .string()
    .trim()
    .regex(/^\d{4,10}$/, "Enter the verification code"),
});

const commonAccountFields = {
  nin: z
    .string()
    .trim()
    .regex(/^\d{11}$/, "NIN must contain exactly 11 digits"),
  isOwnerDriver: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .transform((value) => value === true || value === "true"),
  bankName: z.string().trim().min(2, "Select a bank"),
  bankCode: z
    .string()
    .trim()
    .regex(/^\d{2,6}$/, "Select a bank"),
  accountNumber: z
    .string()
    .trim()
    .regex(/^\d{10}$/, "Account number must contain exactly 10 digits"),
  driversLicense: optionalDocumentSchema,
  lasdri: optionalDocumentSchema,
};

export const onboardingAccountFormSchema = z
  .discriminatedUnion("accountType", [
    z.object({
      ...commonAccountFields,
      accountType: z.literal("INDIVIDUAL"),
    }),
    z.object({
      ...commonAccountFields,
      accountType: z.literal("BUSINESS"),
      businessName: z.string().trim().min(2, "Business name is required").max(200),
      registrationNumber: z
        .string()
        .trim()
        .regex(/^[A-Za-z0-9-]{2,30}$/, "Enter a valid registration number"),
      registrationType: z.enum(["RC", "BN", "IT", "LP", "LLP"]),
    }),
  ])
  .superRefine(({ driversLicense, isOwnerDriver, lasdri }, context) => {
    if (isOwnerDriver && !driversLicense) {
      context.addIssue({
        code: "custom",
        message: "Driver's licence is required for owner-drivers",
        path: ["driversLicense"],
      });
    }

    if (!isOwnerDriver && (driversLicense || lasdri)) {
      context.addIssue({
        code: "custom",
        message: "Driver documents are only accepted for owner-drivers",
        path: [driversLicense ? "driversLicense" : "lasdri"],
      });
    }

    for (const [field, file] of [
      ["driversLicense", driversLicense],
      ["lasdri", lasdri],
    ] as const) {
      if (!file) continue;
      if (!DOCUMENT_TYPES.has(file.type)) {
        context.addIssue({
          code: "custom",
          message: "Use a JPEG, PNG, WebP, or PDF file",
          path: [field],
        });
      }
      if (file.size <= 0 || file.size > MAX_DOCUMENT_SIZE_BYTES) {
        context.addIssue({
          code: "custom",
          message: "File must not exceed 5 MB",
          path: [field],
        });
      }
    }
  });

export const onboardingDriverLicenseReplacementFormSchema = z
  .object({ file: z.file() })
  .superRefine(({ file }, context) => {
    if (!DOCUMENT_TYPES.has(file.type)) {
      context.addIssue({
        code: "custom",
        message: "Use a JPEG, PNG, WebP, or PDF file",
        path: ["file"],
      });
    }
    if (file.size <= 0 || file.size > MAX_DOCUMENT_SIZE_BYTES) {
      context.addIssue({
        code: "custom",
        message: "File must not exceed 5 MB",
        path: ["file"],
      });
    }
  });

export type OnboardingAccountFormInput = z.input<typeof onboardingAccountFormSchema>;
export type OnboardingAccountFormValue = z.output<typeof onboardingAccountFormSchema>;

export type OnboardingActionData = {
  readonly intent: "send-phone" | "check-phone" | "verify-account" | "replace-driver-license";
  readonly error?: string;
  readonly notice?: string;
  readonly phoneNumber?: string;
  readonly revalidate?: false;
  readonly submission?: SubmissionResult<string[]>;
};
