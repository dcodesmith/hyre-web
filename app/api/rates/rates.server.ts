import { env } from "cloudflare:workers";

import { ApiRequestError, createApiClient } from "../api.server";
import { type PublicRates, publicRatesSchema } from "./schema";

let apiClient: ReturnType<typeof createApiClient> | undefined;

function getApiClient() {
  apiClient ??= createApiClient({ apiOrigin: env.API_ORIGIN });

  return apiClient;
}

export const FALLBACK_PUBLIC_RATES: PublicRates = {
  platformCustomerServiceFeeRatePercent: 0,
  vatRatePercent: 7.5,
  securityDetailRate: 0,
};

export type GetPublicRatesOptions = {
  request?: Request;
};

export function getPublicRates(options: GetPublicRatesOptions = {}) {
  return getApiClient().request({
    path: "/api/rates",
    request: options.request,
    schema: publicRatesSchema,
  });
}

export async function loadPublicRates(options: GetPublicRatesOptions = {}) {
  try {
    return (await getPublicRates(options)).data;
  } catch (error) {
    if (error instanceof ApiRequestError && error.kind === "aborted") {
      throw error;
    }

    return FALLBACK_PUBLIC_RATES;
  }
}
