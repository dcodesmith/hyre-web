import { z } from "zod";

const PHONE_NUMBER_ERROR = "Enter a phone number in international format";

export const phoneNumberSchema = z
  .string({ error: "Phone number is required" })
  .trim()
  .refine((value) => !/\(\s*0\s*\)/.test(value), PHONE_NUMBER_ERROR)
  .transform((value) => value.replace(/[\s()-]/g, ""))
  .pipe(z.string().regex(/^\+[1-9]\d{7,14}$/, PHONE_NUMBER_ERROR));

export const phoneVerificationSendSchema = z.object({
  phoneNumber: phoneNumberSchema,
});

export const phoneVerificationCheckSchema = phoneVerificationSendSchema.extend({
  code: z
    .string({ error: "Verification code is required" })
    .trim()
    .regex(/^\d{4,10}$/, "Enter the verification code"),
});
