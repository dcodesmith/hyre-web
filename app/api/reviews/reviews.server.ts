import { env } from "cloudflare:workers";
import { z } from "zod";

import { createApiClient } from "../api.server";
import { carReviewsResponseSchema, reviewMutationResponseSchema } from "./schema";

const reviewPageSchema = z.number().int().min(1).default(1);
const reviewLimitSchema = z.number().int().min(1).max(100).default(10);
let apiClient: ReturnType<typeof createApiClient> | undefined;

function getApiClient() {
  apiClient ??= createApiClient({ apiOrigin: env.API_ORIGIN });

  return apiClient;
}

export type GetCarReviewsOptions = {
  request?: Request;
  carId: string;
  page?: number;
  limit?: number;
  includeRatings?: boolean;
};

export function getCarReviews(options: GetCarReviewsOptions) {
  const search = new URLSearchParams({
    page: String(reviewPageSchema.parse(options.page)),
    limit: String(reviewLimitSchema.parse(options.limit)),
    includeRatings: options.includeRatings === false ? "false" : "true",
  });

  return getApiClient().request({
    path: `/api/reviews/car/${options.carId}?${search}`,
    request: options.request,
    schema: carReviewsResponseSchema,
  });
}

type CreateReviewBody = {
  readonly bookingId: string;
  readonly overallRating: number;
  readonly carRating: number;
  readonly chauffeurRating: number;
  readonly serviceRating: number;
  readonly comment?: string;
};

type UpdateReviewBody = {
  readonly overallRating: number;
  readonly carRating: number;
  readonly chauffeurRating: number;
  readonly serviceRating: number;
  readonly comment?: string | null;
};

export function createReview({
  request,
  body,
}: {
  readonly request: Request;
  readonly body: CreateReviewBody;
}) {
  return getApiClient().request({
    path: "/api/reviews/create",
    request,
    forwardCookie: true,
    json: body,
    schema: reviewMutationResponseSchema,
  });
}

export function updateReview({
  request,
  reviewId,
  body,
}: {
  readonly request: Request;
  readonly reviewId: string;
  readonly body: UpdateReviewBody;
}) {
  return getApiClient().request({
    path: `/api/reviews/${encodeURIComponent(reviewId)}`,
    method: "PUT",
    request,
    forwardCookie: true,
    json: body,
    schema: reviewMutationResponseSchema,
  });
}
