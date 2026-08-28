import { env } from "cloudflare:workers";
import type { z } from "zod";
import { createApiClient } from "~/api/api.server";
import {
  addonRateMutationSchema,
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

type CreateAddonRateBody = RateWindowBody & {
  readonly addonType: "SECURITY_DETAIL";
  readonly rateAmount: number;
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

export function createAdminAddonRate({
  request,
  body,
}: {
  readonly request: Request;
  readonly body: CreateAddonRateBody;
}) {
  return getApiClient().request({
    path: "/api/rates/addon",
    method: "POST",
    request,
    forwardCookie: true,
    json: body,
    schema: addonRateMutationSchema,
  });
}

export function endAdminAddonRate({
  request,
  addonRateId,
}: {
  readonly request: Request;
  readonly addonRateId: string;
}) {
  return getApiClient().request({
    path: `/api/rates/addon/${encodeURIComponent(addonRateId)}/end`,
    method: "PATCH",
    request,
    forwardCookie: true,
    schema: addonRateMutationSchema,
  });
}
