import { z } from "zod";

export const phoneNumberSchema = z
  .string({ error: "Phone number is required" })
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/, "Enter a phone number in international format");

export const phoneVerificationSendSchema = z.object({
  phoneNumber: phoneNumberSchema,
});

export const phoneVerificationCheckSchema = phoneVerificationSendSchema.extend({
  code: z
    .string({ error: "Verification code is required" })
    .trim()
    .regex(/^\d{4,10}$/, "Enter the verification code"),
});
