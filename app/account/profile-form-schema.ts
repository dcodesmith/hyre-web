import { z } from "zod";

export const profileFormSchema = z.object({
  name: z.string().trim().max(200),
  phoneNumber: z.string().trim().max(32),
  city: z.string().trim().max(120),
  address: z.string().trim().max(500),
  marketingConsent: z
    .string()
    .optional()
    .transform((value) => value === "on"),
});
