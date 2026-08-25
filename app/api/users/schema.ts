import { z } from "zod";

export const currentUserProfileSchema = z.object({
  name: z.string().nullable(),
  phoneNumber: z.string().nullable(),
  city: z.string().nullable(),
  address: z.string().nullable(),
  marketingConsent: z.boolean(),
});

export type CurrentUserProfile = z.output<typeof currentUserProfileSchema>;
