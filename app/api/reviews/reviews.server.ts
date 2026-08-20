import { env } from "cloudflare:workers";
import { z } from "zod";

import { createApiClient } from "../api.server";
import { carReviewsResponseSchema } from "./schema";

const reviewPageSchema = z.number().int().min(1).default(1);
const reviewLimitSchema = z.number().int().min(1).max(100).default(10);
let apiClient: ReturnType<typeof createApiClient> | undefined;

function getApiClient() {
  apiClient ??= createApiClient({ apiOrigin: env.API_ORIGIN });

  return apiClient;
}

export function getCarReviews(options: {
  request?: Request;
  carId: string;
  page?: number;
  limit?: number;
  includeRatings?: boolean;
}) {
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
