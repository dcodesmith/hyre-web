import { env } from "cloudflare:workers";

import { createApiClient } from "../api.server";
import { deleteAccountResponseSchema } from "./schema";

let apiClient: ReturnType<typeof createApiClient> | undefined;

function getApiClient() {
  apiClient ??= createApiClient({ apiOrigin: env.API_ORIGIN });

  return apiClient;
}

export function deleteCurrentUserAccount({ request }: { readonly request: Request }) {
  return getApiClient().request({
    path: "/api/account/delete",
    method: "POST",
    request,
    forwardCookie: true,
    schema: deleteAccountResponseSchema,
  });
}
