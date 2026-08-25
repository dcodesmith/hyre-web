import { env } from "cloudflare:workers";

import { createApiClient } from "../api.server";
import { currentUserProfileSchema } from "./schema";

let apiClient: ReturnType<typeof createApiClient> | undefined;

function getApiClient() {
  apiClient ??= createApiClient({ apiOrigin: env.API_ORIGIN });

  return apiClient;
}

export type GetCurrentUserProfileOptions = {
  request: Request;
};

export type UpdateCurrentUserProfileOptions = {
  request: Request;
  body: {
    name: string;
    phoneNumber: string;
    city: string;
    address: string;
    marketingConsent: boolean;
  };
};

export function getCurrentUserProfile(options: GetCurrentUserProfileOptions) {
  return getApiClient().request({
    path: "/api/users/me",
    request: options.request,
    forwardCookie: true,
    schema: currentUserProfileSchema,
  });
}

export function updateCurrentUserProfile(options: UpdateCurrentUserProfileOptions) {
  return getApiClient().request({
    path: "/api/users/me",
    method: "PATCH",
    request: options.request,
    forwardCookie: true,
    json: options.body,
    schema: currentUserProfileSchema,
  });
}
