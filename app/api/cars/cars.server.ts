import { env } from "cloudflare:workers";
import { z } from "zod";

import { collectPublicSitemapCars, sitemapSearchParams } from "~/seo/sitemap";
import { ApiRequestError, createApiClient } from "../api.server";
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

export type GetCarCategoriesOptions = {
  request?: Request;
  limit?: number;
};

export type SearchCarsOptions = {
  request?: Request;
  search: URLSearchParams;
};

export type ListPublicSitemapCarsOptions = {
  request?: Request;
};

export type GetPublicCarOptions = {
  request?: Request;
  carId: string;
  from?: string | null;
};

export function getCarCategories(options: GetCarCategoriesOptions = {}) {
  const limit = carCategoriesLimitSchema.parse(options.limit);
  const search = new URLSearchParams({ limit: String(limit) });

  return getApiClient().request({
    path: `/api/cars/categories?${search}`,
    request: options.request,
    schema: carCategoriesResponseSchema,
  });
}

export function searchCars(options: SearchCarsOptions) {
  return getApiClient().request({
    path: `/api/cars/search?${options.search}`,
    request: options.request,
    schema: carSearchResponseSchema,
  });
}

export function listPublicSitemapCars(options: ListPublicSitemapCarsOptions = {}) {
  return collectPublicSitemapCars({
    searchPage: async (page) => {
      const response = await searchCars({
        request: options.request,
        search: sitemapSearchParams(page),
      });

      return {
        cars: response.data.cars,
        totalPages: response.data.pagination.totalPages,
      };
    },
    isAbortError,
  });
}

function isAbortError(error: unknown) {
  return error instanceof ApiRequestError && error.kind === "aborted";
}

export function getPublicCar(options: GetPublicCarOptions) {
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
