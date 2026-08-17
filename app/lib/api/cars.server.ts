import { env } from "cloudflare:workers";

import { createApiClient } from "./api.server";
import {
  carCategoriesOptionsSchema,
  carCategoriesResponseSchema,
  type CarCategoriesOptions,
} from "./contracts/car-categories";
import { apiEndpoints } from "./endpoints";

const nestApi = createApiClient({ apiOrigin: env.API_ORIGIN });

type GetCarCategoriesOptions = CarCategoriesOptions & {
  request?: Request;
};

export async function getCarCategories(options: GetCarCategoriesOptions = {}) {
  const { limit, from } = carCategoriesOptionsSchema.parse(options);

  return nestApi.request({
    path: apiEndpoints.cars.categories({ limit, from }),
    request: options.request,
    schema: carCategoriesResponseSchema,
    timeoutMs: 10_000,
  });
}
