import type { SubmissionResult } from "@conform-to/react";
import { z } from "zod";

import { addFileValidationIssues } from "~/components/forms/file-validation";

const SELFIE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const idempotencyKeySchema = z.uuid();

export const chauffeurConsentFormSchema = z.object({
  termsAccepted: z.literal("on", { error: "Accept the terms to continue" }),
  privacyAccepted: z.literal("on", { error: "Accept the privacy policy to continue" }),
});

export const chauffeurPhoneCodeFormSchema = z.object({
  code: z
    .string({ error: "Verification code is required" })
    .trim()
    .regex(/^\d{4,10}$/, "Enter the verification code"),
});

export const chauffeurNinFormSchema = z.object({
  nin: z
    .string({ error: "NIN is required" })
    .trim()
    .regex(/^\d{11}$/, "NIN must contain exactly 11 digits"),
  idempotencyKey: idempotencyKeySchema,
});

export const chauffeurDrivingFormSchema = z
  .object({
    driversLicenseNumber: z
      .string({ error: "Driver's licence number is required" })
      .trim()
      .min(5, "Driver's licence number must contain at least 5 characters")
      .max(30)
      .regex(/^[A-Za-z0-9-]+$/, "Enter a valid driver's licence number"),
    selfie: z.file({ error: "Take or upload a clear passport photograph" }),
    idempotencyKey: idempotencyKeySchema,
  })
  .superRefine(({ selfie }, context) => {
    addFileValidationIssues({
      allowedTypes: SELFIE_TYPES,
      context,
      emptyMessage: "The selected image is empty",
      file: selfie,
      invalidTypeMessage: "Use a JPEG, PNG, or WebP image",
      oversizedMessage: "Image must not exceed 5 MB",
      path: ["selfie"],
    });
  });

export type ChauffeurOnboardingIntent =
  | "accept-consent"
  | "send-phone"
  | "check-phone"
  | "verify-nin"
  | "verify-driving";

export type ChauffeurOnboardingActionData = {
  readonly intent: ChauffeurOnboardingIntent;
  readonly error?: string;
  readonly idempotencyKey?: string;
  readonly notice?: string;
  readonly revalidate?: false;
  readonly submission?: SubmissionResult<string[]>;
};
