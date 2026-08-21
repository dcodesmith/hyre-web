import { z } from "zod";

export const aiSearchQuerySchema = z.string().trim().min(1, "Query is required").max(500);
