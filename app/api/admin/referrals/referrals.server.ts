import { env } from "cloudflare:workers";
import { createApiClient } from "~/api/api.server";
import {
  type ReferralProgramStatus,
  type ReferralProgramValues,
  referralProgramHistorySchema,
  referralProgramSchema,
} from "./schema";

let apiClient: ReturnType<typeof createApiClient> | undefined;

function getApiClient() {
  apiClient ??= createApiClient({ apiOrigin: env.API_ORIGIN });
  return apiClient;
}

export function getAdminReferralProgram({ request }: { readonly request: Request }) {
  return getApiClient().request({
    path: "/api/admin/referral-program",
    request,
    forwardCookie: true,
    schema: referralProgramSchema,
  });
}

export function getAdminReferralProgramHistory({ request }: { readonly request: Request }) {
  return getApiClient().request({
    path: "/api/admin/referral-program/history?page=1&pageSize=20",
    request,
    forwardCookie: true,
    schema: referralProgramHistorySchema,
  });
}

export function createAdminReferralProgram({
  request,
  body,
}: {
  readonly request: Request;
  readonly body: ReferralProgramValues;
}) {
  return getApiClient().request({
    path: "/api/admin/referral-program",
    method: "POST",
    request,
    forwardCookie: true,
    json: body,
    schema: referralProgramSchema,
  });
}

export function updateAdminReferralProgram({
  request,
  body,
}: {
  readonly request: Request;
  readonly body: Partial<ReferralProgramValues> & { readonly status?: ReferralProgramStatus };
}) {
  return getApiClient().request({
    path: "/api/admin/referral-program",
    method: "PATCH",
    request,
    forwardCookie: true,
    json: body,
    schema: referralProgramSchema,
  });
}
