import { z } from "zod";

export const TERMS_ACCEPTANCE_ERROR = "You must accept the Terms of Service and Privacy Policy";
export const EMAIL_INVALID_ERROR = "Email address is not valid.";
export const OTP_CODE_ERROR = "Code must be exactly 6 digits.";
export const REFERRAL_CODE_PATTERN = /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/;

export function validReferralCode(value: string | null | undefined) {
  const ref = value?.trim().toUpperCase() ?? "";
  return REFERRAL_CODE_PATTERN.test(ref) ? ref : "";
}

const referralCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(REFERRAL_CODE_PATTERN, "Referral code must be 8 characters")
  .optional()
  .or(z.literal(""));

export const loginFormSchema = z.object({
  email: z
    .string({ error: EMAIL_INVALID_ERROR })
    .trim()
    .toLowerCase()
    .pipe(z.email(EMAIL_INVALID_ERROR)),
  referralCode: referralCodeSchema,
  acceptTerms: z.string({ error: TERMS_ACCEPTANCE_ERROR }).refine((value) => value === "on", {
    message: TERMS_ACCEPTANCE_ERROR,
  }),
});

export const roleLoginFormSchema = loginFormSchema.omit({ referralCode: true });

export const verifyFormSchema = z.object({
  code: z.string({ error: OTP_CODE_ERROR }).regex(/^\d{6}$/, OTP_CODE_ERROR),
});

export const pendingOtpSchema = z.object({
  email: z.email(),
  referralCode: z.string().trim().toUpperCase().regex(REFERRAL_CODE_PATTERN).optional(),
});

export type PendingOtp = z.infer<typeof pendingOtpSchema>;
