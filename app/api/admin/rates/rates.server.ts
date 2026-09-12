import { env } from "cloudflare:workers";
import type { z } from "zod";
import { createApiClient } from "~/api/api.server";
import {
  adminRatesSchema,
  platformFeeRateMutationSchema,
  type platformFeeTypeSchema,
  vatRateMutationSchema,
} from "./schema";

let apiClient: ReturnType<typeof createApiClient> | undefined;

function getApiClient() {
  apiClient ??= createApiClient({ apiOrigin: env.API_ORIGIN });
  return apiClient;
}

type RateWindowBody = {
  readonly effectiveSince: string;
  readonly effectiveUntil?: string;
  readonly description?: string;
};

type CreatePlatformFeeBody = RateWindowBody & {
  readonly feeType: z.infer<typeof platformFeeTypeSchema>;
  readonly ratePercent: number;
};

type CreateVatRateBody = RateWindowBody & {
  readonly ratePercent: number;
};

export function getAdminRates({ request }: { readonly request: Request }) {
  return getApiClient().request({
    path: "/api/rates/admin",
    request,
    forwardCookie: true,
    schema: adminRatesSchema,
  });
}

export function createAdminPlatformFee({
  request,
  body,
}: {
  readonly request: Request;
  readonly body: CreatePlatformFeeBody;
}) {
  return getApiClient().request({
    path: "/api/rates/platform-fee",
    method: "POST",
    request,
    forwardCookie: true,
    json: body,
    schema: platformFeeRateMutationSchema,
  });
}

export function createAdminVatRate({
  request,
  body,
}: {
  readonly request: Request;
  readonly body: CreateVatRateBody;
}) {
  return getApiClient().request({
    path: "/api/rates/vat",
    method: "POST",
    request,
    forwardCookie: true,
    json: body,
    schema: vatRateMutationSchema,
  });
}
