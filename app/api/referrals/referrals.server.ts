import { env } from "cloudflare:workers";

import { createApiClient } from "../api.server";
import { referralSummarySchema } from "./schema";

let apiClient: ReturnType<typeof createApiClient> | undefined;

function getApiClient() {
  apiClient ??= createApiClient({ apiOrigin: env.API_ORIGIN });

  return apiClient;
}

export function getCurrentUserReferralSummary({ request }: { readonly request: Request }) {
  return getApiClient().request({
    path: "/api/referrals/user",
    request,
    forwardCookie: true,
    schema: referralSummarySchema,
  });
}
