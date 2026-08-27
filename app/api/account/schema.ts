import { z } from "zod";

export const deleteAccountResponseSchema = z.object({
  success: z.literal(true),
});
