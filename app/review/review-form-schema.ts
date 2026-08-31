import { z } from "zod";

const RATING_ERROR = "Choose a rating from 1 to 5 stars.";
const COMMENT_ERROR = "Comment cannot exceed 2000 characters.";

const ratingSchema = z.coerce
  .number({ error: RATING_ERROR })
  .int(RATING_ERROR)
  .min(1, RATING_ERROR)
  .max(5, RATING_ERROR);

const ratingsSchema = {
  overallRating: ratingSchema,
  carRating: ratingSchema,
  chauffeurRating: ratingSchema,
  serviceRating: ratingSchema,
};

const commentSchema = z.string({ error: COMMENT_ERROR }).trim().max(2000, COMMENT_ERROR);

const createReviewFormSchema = z.object({
  intent: z.literal("create-review"),
  ...ratingsSchema,
  comment: commentSchema.transform((comment) => comment || undefined),
});

const updateReviewFormSchema = z.object({
  intent: z.literal("update-review"),
  reviewId: z.string().min(1),
  ...ratingsSchema,
  comment: commentSchema.transform((comment) => comment || null),
});

export const reviewFormSchema = z.discriminatedUnion("intent", [
  createReviewFormSchema,
  updateReviewFormSchema,
]);

export type ReviewFieldErrors = Partial<
  Record<
    "overallRating" | "carRating" | "chauffeurRating" | "serviceRating" | "comment" | "reviewId",
    string[]
  >
>;
