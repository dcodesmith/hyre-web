import { env } from "cloudflare:workers";

import { createApiClient } from "../api.server";
import { currentUserProfileSchema, phoneVerificationSchema } from "./schema";

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

export function sendCurrentUserPhoneVerification({
  request,
  phoneNumber,
}: {
  readonly request: Request;
  readonly phoneNumber: string;
}) {
  return getApiClient().request({
    path: "/api/users/me/phone-verifications",
    method: "POST",
    request,
    forwardCookie: true,
    json: { phoneNumber },
    schema: phoneVerificationSchema,
  });
}

export function checkCurrentUserPhoneVerification({
  request,
  phoneNumber,
  code,
}: {
  readonly request: Request;
  readonly phoneNumber: string;
  readonly code: string;
}) {
  return getApiClient().request({
    path: "/api/users/me/phone-verification-checks",
    method: "POST",
    request,
    forwardCookie: true,
    json: { phoneNumber, code },
    schema: phoneVerificationSchema,
  });
}
