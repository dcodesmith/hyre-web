import { z } from "zod";

export const LoginSchema = z.object({
  email: z.email("Email address is not valid."),
  referralCode: z
    .string()
    .length(8, "Referral code must be exactly 8 characters")
    .regex(/^[123456789ABCDEFGHJKLMNPQRSTUVWXYZ]+$/, "Invalid referral code format")
    .optional()
    .or(z.literal("")),
  acceptTerms: z
    .string({ error: "You must accept the Terms of Service and Privacy Policy" })
    .refine((val) => val === "on", {
      message: "You must accept the Terms of Service and Privacy Policy",
    })
    .transform(() => true),
});

export const AdminLoginSchema = z.object({
  email: z.email("Email address is not valid."),
});
