import type { SubmissionResult } from "@conform-to/react";
import { z } from "zod";
import { addFileValidationIssues } from "~/components/forms/file-validation";

const DOCUMENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

const phoneNumberSchema = z
  .string({ error: "Phone number is required" })
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/, "Enter a phone number in international format");

const optionalDocumentSchema = z.file().optional();

export const onboardingPhoneFormSchema = z.object({
  phoneNumber: phoneNumberSchema,
});

export const onboardingPhoneCheckFormSchema = onboardingPhoneFormSchema.extend({
  code: z
    .string({ error: "Verification code is required" })
    .trim()
    .regex(/^\d{4,10}$/, "Enter the verification code"),
});

const ninSchema = z
  .string({ error: "NIN is required" })
  .trim()
  .regex(/^\d{11}$/, "NIN must contain exactly 11 digits");

export const onboardingIdentityFormSchema = z.discriminatedUnion("accountType", [
  z.object({
    accountType: z.literal("INDIVIDUAL"),
    nin: ninSchema,
  }),
  z.object({
    accountType: z.literal("BUSINESS"),
    nin: ninSchema,
    businessName: z
      .string({ error: "Business name is required" })
      .trim()
      .min(2, "Business name is required")
      .max(200),
    registrationNumber: z
      .string({ error: "Registration number is required" })
      .trim()
      .regex(/^[A-Za-z0-9-]{2,30}$/, "Enter a valid registration number"),
    registrationType: z.enum(["RC", "BN", "IT", "LP", "LLP"], {
      error: "Select a registration type",
    }),
  }),
]);

export const onboardingPayoutFormSchema = z.object({
  bankCode: z
    .string({ error: "Select a bank" })
    .trim()
    .regex(/^\d{2,6}$/, "Select a bank"),
  accountNumber: z
    .string({ error: "Account number is required" })
    .trim()
    .regex(/^\d{10}$/, "Account number must contain exactly 10 digits"),
});

function addDocumentIssues(
  context: z.RefinementCtx,
  field: "driversLicense" | "lasdri" | "file",
  file: File | undefined,
) {
  addFileValidationIssues({
    allowedTypes: DOCUMENT_TYPES,
    context,
    emptyMessage: "The selected file is empty",
    file,
    invalidTypeMessage: "Use a JPEG, PNG, WebP, or PDF file",
    oversizedMessage: "File must not exceed 5 MB",
    path: [field],
  });
}

export const onboardingDrivingFormSchema = z
  .object({
    isOwnerDriver: z
      .union([z.boolean(), z.enum(["true", "false"])], {
        error: "Choose whether you will drive",
      })
      .transform((value) => value === true || value === "true"),
    driversLicense: optionalDocumentSchema,
    lasdri: optionalDocumentSchema,
  })
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

    addDocumentIssues(context, "driversLicense", driversLicense);
    addDocumentIssues(context, "lasdri", lasdri);
  });

export const onboardingDriverLicenseReplacementFormSchema = z
  .object({ file: z.file({ error: "Upload a replacement driver's licence" }) })
  .superRefine(({ file }, context) => {
    addDocumentIssues(context, "file", file);
  });

export type OnboardingIdentityFormInput = z.input<typeof onboardingIdentityFormSchema>;
export type OnboardingIdentityFormValue = z.output<typeof onboardingIdentityFormSchema>;
export type OnboardingPayoutFormInput = z.input<typeof onboardingPayoutFormSchema>;
export type OnboardingDrivingFormInput = z.input<typeof onboardingDrivingFormSchema>;
export type OnboardingDrivingFormValue = z.output<typeof onboardingDrivingFormSchema>;

export type OnboardingActionIntent =
  | "send-phone"
  | "check-phone"
  | "verify-identity"
  | "verify-payout"
  | "save-driving"
  | "submit-account"
  | "replace-driver-license";

export type OnboardingActionData = {
  readonly intent: OnboardingActionIntent;
  readonly error?: string;
  readonly idempotencyKey?: string;
  readonly notice?: string;
  readonly phoneNumber?: string;
  readonly revalidate?: false;
  readonly submission?: SubmissionResult<string[]>;
};
