import { env } from "cloudflare:workers";

import { createApiClient } from "~/api/api.server";
import { fleetOwnerPromotionMutationSchema, fleetOwnerPromotionsSchema } from "./schema";

let apiClient: ReturnType<typeof createApiClient> | undefined;

function getApiClient() {
  apiClient ??= createApiClient({ apiOrigin: env.API_ORIGIN });

  return apiClient;
}

type CreateFleetOwnerPromotionBody = {
  readonly name?: string;
  readonly scope: "FLEET" | "CAR";
  readonly carId?: string;
  readonly discountValue: number;
  readonly startDate: string;
  readonly endDate: string;
};

export function getFleetOwnerPromotions({ request }: { readonly request: Request }) {
  return getApiClient().request({
    path: "/api/fleet-owner/promotions",
    request,
    forwardCookie: true,
    schema: fleetOwnerPromotionsSchema,
  });
}

export function createFleetOwnerPromotion({
  request,
  body,
}: {
  readonly request: Request;
  readonly body: CreateFleetOwnerPromotionBody;
}) {
  return getApiClient().request({
    path: "/api/fleet-owner/promotions",
    method: "POST",
    request,
    forwardCookie: true,
    json: body,
    schema: fleetOwnerPromotionMutationSchema,
  });
}

export function deactivateFleetOwnerPromotion({
  request,
  promotionId,
}: {
  readonly request: Request;
  readonly promotionId: string;
}) {
  return getApiClient().request({
    path: `/api/fleet-owner/promotions/${encodeURIComponent(promotionId)}/deactivate`,
    method: "POST",
    request,
    forwardCookie: true,
    schema: fleetOwnerPromotionMutationSchema,
  });
}
