import { z } from "zod";

export const currentUserProfileSchema = z.object({
  name: z.string().nullable(),
  phoneNumber: z.string().nullable(),
  phoneVerified: z.boolean(),
  city: z.string().nullable(),
  address: z.string().nullable(),
  marketingConsent: z.boolean(),
});

export const phoneVerificationSchema = z.object({
  status: z.enum(["PENDING", "VERIFIED"]),
  phoneNumber: z.string(),
});

export type CurrentUserProfile = z.output<typeof currentUserProfileSchema>;
