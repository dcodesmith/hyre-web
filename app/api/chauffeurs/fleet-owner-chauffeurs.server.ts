import { env } from "cloudflare:workers";

import { createApiClient } from "~/api/api.server";
import { fleetOwnerChauffeurSchema, fleetOwnerChauffeursSchema } from "./schema";

let apiClient: ReturnType<typeof createApiClient> | undefined;

function getApiClient() {
  apiClient ??= createApiClient({ apiOrigin: env.API_ORIGIN });
  return apiClient;
}

export function getFleetOwnerChauffeurs({
  request,
  searchParams,
}: {
  readonly request: Request;
  readonly searchParams: URLSearchParams;
}) {
  return getApiClient().request({
    path: `/api/fleet-owner/chauffeurs?${searchParams}`,
    request,
    forwardCookie: true,
    schema: fleetOwnerChauffeursSchema,
  });
}

export function inviteFleetOwnerChauffeur({
  request,
  idempotencyKey,
  body,
}: {
  readonly request: Request;
  readonly idempotencyKey: string;
  readonly body: {
    readonly name: string;
    readonly email: string;
    readonly phoneNumber: string;
  };
}) {
  return getApiClient().request({
    path: "/api/fleet-owner/chauffeur-invitations",
    method: "POST",
    request,
    forwardCookie: true,
    headers: { "Idempotency-Key": idempotencyKey },
    json: body,
    schema: fleetOwnerChauffeurSchema,
  });
}

export function updateFleetOwnerChauffeur({
  request,
  chauffeurId,
  isActive,
}: {
  readonly request: Request;
  readonly chauffeurId: string;
  readonly isActive: boolean;
}) {
  return getApiClient().request({
    path: `/api/fleet-owner/chauffeurs/${encodeURIComponent(chauffeurId)}`,
    method: "PATCH",
    request,
    forwardCookie: true,
    json: { isActive },
    schema: fleetOwnerChauffeurSchema,
  });
}
