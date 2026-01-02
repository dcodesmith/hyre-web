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
