import { env } from "cloudflare:workers";
import { createApiClient } from "../api.server";
import { aiSearchQuerySchema, aiSearchResponseSchema } from "./schema";

let apiClient: ReturnType<typeof createApiClient> | undefined;

function getApiClient() {
  apiClient ??= createApiClient({ apiOrigin: env.API_ORIGIN });

  return apiClient;
}

export function searchWithAi(options: { request?: Request; query: string }) {
  return getApiClient().request({
    path: "/api/ai-search",
    method: "POST",
    request: options.request,
    json: { query: aiSearchQuerySchema.parse(options.query) },
    schema: aiSearchResponseSchema,
    // ponytail: 20s for OpenAI extraction; default 10s is tight
    timeoutMs: 20_000,
  });
}
