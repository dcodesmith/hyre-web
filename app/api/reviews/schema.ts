import { z } from "zod";

const ratingSchema = z.number().int().min(1).max(5);

const reviewUserSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  image: z.string().nullable(),
});

export const customerReviewSchema = z.object({
  id: z.string(),
  overallRating: ratingSchema,
  carRating: ratingSchema,
  chauffeurRating: ratingSchema.nullable(),
  serviceRating: ratingSchema,
  comment: z.string().nullable(),
  createdAt: z.iso.datetime({ offset: true }),
  user: reviewUserSchema,
});

export const carReviewSchema = customerReviewSchema;

export const reviewMutationResponseSchema = z.object({
  id: z.string(),
});

export const reviewPaginationSchema = z.object({
  page: z.number().int(),
  limit: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean(),
});

export const aggregatedRatingsSchema = z.object({
  averageRating: z.number(),
  totalReviews: z.number().int(),
  ratingDistribution: z.object({
    1: z.number().int(),
    2: z.number().int(),
    3: z.number().int(),
    4: z.number().int(),
    5: z.number().int(),
  }),
});

export const carReviewsResponseSchema = z.object({
  reviews: z.array(carReviewSchema),
  pagination: reviewPaginationSchema,
  ratings: aggregatedRatingsSchema.optional(),
});

export type CustomerReview = z.infer<typeof customerReviewSchema>;
export type CarReview = CustomerReview;
export type CarReviewsResponse = z.infer<typeof carReviewsResponseSchema>;
