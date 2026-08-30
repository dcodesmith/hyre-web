import { z } from "zod";

function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => value ?? "");
}

export const profileFormSchema = z.object({
  name: optionalText(200),
  phoneNumber: optionalText(32),
  city: optionalText(120),
  address: optionalText(500),
  marketingConsent: z
    .string()
    .optional()
    .transform((value) => value === "on"),
});
