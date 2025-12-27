import { z } from "zod";

export const VerifySchema = z.object({
  code: z
    .string({
      error: "Code is required.",
    })
    .regex(/^\d{6}$/, "Code must be exactly 6 digits."),
});
