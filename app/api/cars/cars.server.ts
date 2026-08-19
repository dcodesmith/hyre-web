import { env } from "cloudflare:workers";
import { z } from "zod";

import { createApiClient } from "../api.server";
import { carCategoriesResponseSchema } from "./schema";

const carCategoriesLimitSchema = z.number().int().min(1).max(100).default(50);
let apiClient: ReturnType<typeof createApiClient> | undefined;

function getApiClient() {
  apiClient ??= createApiClient({ apiOrigin: env.API_ORIGIN });

  return apiClient;
}

export function getCarCategories(options: { request?: Request; limit?: number } = {}) {
  const limit = carCategoriesLimitSchema.parse(options.limit);
  const search = new URLSearchParams({ limit: String(limit) });

  return getApiClient().request({
    path: `/api/cars/categories?${search}`,
    request: options.request,
    schema: carCategoriesResponseSchema,
  });
}
