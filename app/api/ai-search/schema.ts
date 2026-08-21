import { z } from "zod";

export const aiSearchResponseSchema = z.object({
  params: z.record(z.string(), z.string()),
});
