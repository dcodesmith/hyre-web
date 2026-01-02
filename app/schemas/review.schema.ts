import { z } from "zod";

const ratingSchema = z
  .number({
    error: "Rating must be a number.",
  })
  .int("Rating must be an integer.")
  .min(1, "Rating must be at least 1 star.")
  .max(5, "Rating cannot exceed 5 stars.");

const baseReviewSchema = z.object({
  overallRating: ratingSchema,
  carRating: ratingSchema,
  chauffeurRating: ratingSchema,
  serviceRating: ratingSchema,
  comment: z.string().max(2000, "Comment cannot exceed 2000 characters.").optional(),
});

export const createReviewSchema = baseReviewSchema.extend({
  bookingId: z.string({ error: "Booking ID is required." }),
});

export const updateReviewSchema = baseReviewSchema.extend({
  overallRating: ratingSchema.optional(),
  carRating: ratingSchema.optional(),
  chauffeurRating: ratingSchema.optional(),
  serviceRating: ratingSchema.optional(),
  comment: z.string().max(2000, "Comment cannot exceed 2000 characters.").optional().nullable(),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;

/**
 * Schema for paginated review query parameters
 * Used for car and chauffeur review endpoints
 */
export const reviewQueryParamsSchema = z.object({
  page: z.preprocess((val) => (val == null ? 1 : Number(val)), z.number().min(1)),
  limit: z.preprocess((val) => (val == null ? 10 : Number(val)), z.number().min(1).max(100)),
  includeRatings: z.preprocess(
    (val) => val ?? undefined,
    z
      .string()
      .optional()
      .transform((val) => val === "true"),
  ),
});

/**
 * Route parameter schemas for review endpoints
 */
export const reviewIdParamSchema = z.string().min(1, { error: "Review ID is required" });
export const bookingIdParamSchema = z.string().min(1, { error: "Booking ID is required" });
export const carIdParamSchema = z.string().min(1, { error: "Car ID is required" });
export const chauffeurIdParamSchema = z.string().min(1, { error: "Chauffeur ID is required" });
