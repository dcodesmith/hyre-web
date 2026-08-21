import { env } from "cloudflare:workers";
import { z } from "zod";

import { createApiClient } from "../api.server";
import { placesAutocompleteResponseSchema, resolvePlaceResponseSchema } from "./schema";

const autocompleteInputSchema = z.string().trim().min(2).max(120);
const sessionTokenSchema = z.string().trim().min(1).max(128).optional();
const placeIdSchema = z.string().trim().min(1).max(256);
let apiClient: ReturnType<typeof createApiClient> | undefined;

function getApiClient() {
  apiClient ??= createApiClient({ apiOrigin: env.API_ORIGIN });

  return apiClient;
}

export function autocompletePlaces(options: {
  request?: Request;
  input: string;
  sessionToken?: string;
  limit?: number;
}) {
  const search = new URLSearchParams({
    input: autocompleteInputSchema.parse(options.input),
    limit: String(options.limit ?? 4),
  });
  const sessionToken = sessionTokenSchema.parse(options.sessionToken);

  if (sessionToken) {
    search.set("sessionToken", sessionToken);
  }

  return getApiClient().request({
    path: `/api/places/autocomplete?${search}`,
    request: options.request,
    schema: placesAutocompleteResponseSchema,
  });
}

export function resolvePlace(options: {
  request?: Request;
  placeId: string;
  sessionToken?: string;
}) {
  return getApiClient().request({
    path: "/api/places/resolve",
    method: "POST",
    request: options.request,
    json: {
      placeId: placeIdSchema.parse(options.placeId),
      sessionToken: sessionTokenSchema.parse(options.sessionToken),
    },
    schema: resolvePlaceResponseSchema,
  });
}
