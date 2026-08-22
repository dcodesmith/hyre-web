import { env } from "cloudflare:workers";
import { createApiClient } from "../api.server";
import { aiSearchQuerySchema } from "./ai-search-form-schema";
import { aiSearchResponseSchema } from "./schema";

let apiClient: ReturnType<typeof createApiClient> | undefined;

function getApiClient() {
  apiClient ??= createApiClient({ apiOrigin: env.API_ORIGIN });

  return apiClient;
}

export type SearchWithAiOptions = {
  request?: Request;
  query: string;
};

export function searchWithAi(options: SearchWithAiOptions) {
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
