import { env } from "cloudflare:workers";

import { createApiClient } from "~/api/api.server";

let apiClient: ReturnType<typeof createApiClient> | undefined;

function getApiClient() {
  apiClient ??= createApiClient({ apiOrigin: env.API_ORIGIN });
  return apiClient;
}

export function getAdminDocument({
  request,
  documentId,
}: {
  readonly request: Request;
  readonly documentId: string;
}) {
  return getApiClient().requestRaw({
    path: `/api/proxy-pdf/${encodeURIComponent(documentId)}`,
    request,
    forwardCookie: true,
    headers: { Accept: "application/pdf" },
  });
}
