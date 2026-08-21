import { env } from "cloudflare:workers";
import { z } from "zod";

import { remainingSitemapPages, SITEMAP_SEARCH_PAGE_SIZE, uniqueSitemapCars } from "~/seo/sitemap";
import { createApiClient } from "../api.server";
import {
  carCategoriesResponseSchema,
  carSearchResponseSchema,
  type PublicCar,
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

export async function listPublicSitemapCars(
  options: { request?: Request } = {},
): Promise<Pick<PublicCar, "id" | "make" | "model" | "year">[]> {
  const first = await searchCars({
    request: options.request,
    search: sitemapSearchParams(1),
  });
  const cars = [...first.data.cars];
  const pages = remainingSitemapPages(first.data.pagination.totalPages);

  if (pages.length === 0) {
    return uniqueSitemapCars(cars);
  }

  try {
    const rest = await Promise.all(
      pages.map((page) =>
        searchCars({
          request: options.request,
          search: sitemapSearchParams(page),
        }),
      ),
    );

    for (const page of rest) {
      cars.push(...page.data.cars);
    }
  } catch {
    // Keep the first page so a later search failure does not empty the sitemap.
  }

  return uniqueSitemapCars(cars);
}

function sitemapSearchParams(page: number) {
  return new URLSearchParams({
    page: String(page),
    limit: String(SITEMAP_SEARCH_PAGE_SIZE),
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
