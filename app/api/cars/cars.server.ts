import { env } from "cloudflare:workers";
import { z } from "zod";

import { createApiClient } from "../api.server";
import {
  carCategoriesResponseSchema,
  carSearchResponseSchema,
  publicCarDetailSchema,
} from "./schema";

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

export function searchCars(options: { request?: Request; search: URLSearchParams }) {
  return getApiClient().request({
    path: `/api/cars/search?${options.search}`,
    request: options.request,
    schema: carSearchResponseSchema,
  });
}

export function getPublicCar(options: { request?: Request; carId: string; from?: string | null }) {
  const search = new URLSearchParams();

  if (options.from) {
    search.set("from", options.from);
  }

  const query = search.toString();

  return getApiClient().request({
    path: query ? `/api/cars/${options.carId}?${query}` : `/api/cars/${options.carId}`,
    request: options.request,
    schema: publicCarDetailSchema,
  });
}
