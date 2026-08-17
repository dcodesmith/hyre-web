import { env } from "cloudflare:workers";

import { createApiClient } from "./api.server";
import { carCategoriesResponseSchema } from "./contracts/car-categories";

const apiClient = createApiClient({ apiOrigin: env.API_ORIGIN });

export function getCarCategories(
  options: { request?: Request; limit?: number } = {},
) {
  const search = new URLSearchParams({ limit: String(options.limit ?? 50) });

  return apiClient.request({
    path: `/api/cars/categories?${search}`,
    request: options.request,
    schema: carCategoriesResponseSchema,
  });
}
