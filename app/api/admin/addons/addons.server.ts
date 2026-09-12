import { env } from "cloudflare:workers";
import type { AddonPricingUnit } from "~/api/addons/schema";
import { createApiClient } from "~/api/api.server";
import type { BookingType } from "~/booking/types";
import {
  type AddonFinancialTreatment,
  addonMutationSchema,
  adminAddonPriceSchema,
  adminAddonsSchema,
} from "./schema";

let apiClient: ReturnType<typeof createApiClient> | undefined;

function getApiClient() {
  apiClient ??= createApiClient({ apiOrigin: env.API_ORIGIN });
  return apiClient;
}

type CreateAddonBody = {
  readonly code: string;
  readonly name: string;
  readonly description?: string;
  readonly bookingTypes: BookingType[];
  readonly pricingUnit: AddonPricingUnit;
  readonly financialTreatment: AddonFinancialTreatment;
  readonly isActive: boolean;
};

type UpdateAddonBody = Pick<CreateAddonBody, "name" | "bookingTypes"> & {
  readonly description: string | null;
  readonly isActive: boolean;
};

type CreateAddonPriceBody = {
  readonly amount: number;
  readonly effectiveSince: string;
  readonly effectiveUntil?: string;
};

export function getAdminAddons({ request }: { readonly request: Request }) {
  return getApiClient().request({
    path: "/api/admin/addons",
    request,
    forwardCookie: true,
    schema: adminAddonsSchema,
  });
}

export function createAdminAddon({
  request,
  body,
}: {
  readonly request: Request;
  readonly body: CreateAddonBody;
}) {
  return getApiClient().request({
    path: "/api/admin/addons",
    method: "POST",
    request,
    forwardCookie: true,
    json: body,
    schema: addonMutationSchema,
  });
}

export function updateAdminAddon({
  request,
  addonId,
  body,
}: {
  readonly request: Request;
  readonly addonId: string;
  readonly body: UpdateAddonBody;
}) {
  return getApiClient().request({
    path: `/api/admin/addons/${encodeURIComponent(addonId)}`,
    method: "PATCH",
    request,
    forwardCookie: true,
    json: body,
    schema: addonMutationSchema,
  });
}

export function createAdminAddonPrice({
  request,
  addonId,
  body,
}: {
  readonly request: Request;
  readonly addonId: string;
  readonly body: CreateAddonPriceBody;
}) {
  return getApiClient().request({
    path: `/api/admin/addons/${encodeURIComponent(addonId)}/prices`,
    method: "POST",
    request,
    forwardCookie: true,
    json: body,
    schema: adminAddonPriceSchema,
  });
}

export function endAdminAddonPrice({
  request,
  addonId,
  priceId,
}: {
  readonly request: Request;
  readonly addonId: string;
  readonly priceId: string;
}) {
  return getApiClient().request({
    path: `/api/admin/addons/${encodeURIComponent(addonId)}/prices/${encodeURIComponent(priceId)}/end`,
    method: "PATCH",
    request,
    forwardCookie: true,
    schema: adminAddonPriceSchema,
  });
}
