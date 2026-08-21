import { z } from "zod";

export const aiSearchQuerySchema = z.string().trim().min(1, "Query is required").max(500);

export const aiSearchResponseSchema = z.object({
  params: z.record(z.string(), z.string()),
});
