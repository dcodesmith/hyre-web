import { z } from "zod";

const referralCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[123456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/, "Referral code must be 8 characters")
  .optional()
  .or(z.literal(""));

export const loginFormSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Email address is not valid.")),
  referralCode: referralCodeSchema,
  acceptTerms: z.string().refine((value) => value === "on", {
    message: "You must accept the Terms of Service and Privacy Policy",
  }),
});

export const verifyFormSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Code must be exactly 6 digits."),
});

export const pendingOtpSchema = z.object({
  email: z.email(),
  referralCode: z.string().optional(),
});

export type LoginForm = z.infer<typeof loginFormSchema>;
export type PendingOtp = z.infer<typeof pendingOtpSchema>;
