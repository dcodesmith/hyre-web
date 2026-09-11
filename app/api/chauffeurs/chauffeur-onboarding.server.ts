import { env } from "cloudflare:workers";

import { createApiClient } from "~/api/api.server";
import {
  chauffeurInvitationExchangeSchema,
  chauffeurOnboardingSchema,
  chauffeurPhoneVerificationSchema,
} from "./schema";

let apiClient: ReturnType<typeof createApiClient> | undefined;

function getApiClient() {
  apiClient ??= createApiClient({ apiOrigin: env.API_ORIGIN });
  return apiClient;
}

function bearerHeaders(sessionToken: string, headers?: HeadersInit) {
  const result = new Headers(headers);
  result.set("Authorization", `Bearer ${sessionToken}`);
  return result;
}

export function exchangeChauffeurInvitation({
  request,
  token,
}: {
  readonly request: Request;
  readonly token: string;
}) {
  return getApiClient().request({
    path: "/api/chauffeur-onboarding/invitation-exchanges",
    method: "POST",
    request,
    json: { token },
    schema: chauffeurInvitationExchangeSchema,
  });
}

export function getChauffeurOnboarding({
  request,
  sessionToken,
}: {
  readonly request: Request;
  readonly sessionToken: string;
}) {
  return getApiClient().request({
    path: "/api/chauffeur-onboarding",
    request,
    headers: bearerHeaders(sessionToken),
    schema: chauffeurOnboardingSchema,
  });
}

export function acceptChauffeurConsent({
  request,
  sessionToken,
}: {
  readonly request: Request;
  readonly sessionToken: string;
}) {
  return getApiClient().request({
    path: "/api/chauffeur-onboarding/consent",
    method: "PUT",
    request,
    headers: bearerHeaders(sessionToken),
    json: { termsAccepted: true, privacyAccepted: true },
    schema: chauffeurOnboardingSchema,
  });
}

export function sendChauffeurPhoneVerification({
  request,
  sessionToken,
}: {
  readonly request: Request;
  readonly sessionToken: string;
}) {
  return getApiClient().request({
    path: "/api/chauffeur-onboarding/phone-verifications",
    method: "POST",
    request,
    headers: bearerHeaders(sessionToken),
    schema: chauffeurPhoneVerificationSchema,
  });
}

export function checkChauffeurPhoneVerification({
  request,
  sessionToken,
  code,
}: {
  readonly request: Request;
  readonly sessionToken: string;
  readonly code: string;
}) {
  return getApiClient().request({
    path: "/api/chauffeur-onboarding/phone-verification-checks",
    method: "POST",
    request,
    headers: bearerHeaders(sessionToken),
    json: { code },
    schema: chauffeurPhoneVerificationSchema,
  });
}

export function verifyChauffeurNin({
  request,
  sessionToken,
  idempotencyKey,
  nin,
}: {
  readonly request: Request;
  readonly sessionToken: string;
  readonly idempotencyKey: string;
  readonly nin: string;
}) {
  return getApiClient().request({
    path: "/api/chauffeur-onboarding/nin-verifications",
    method: "POST",
    request,
    headers: bearerHeaders(sessionToken, { "Idempotency-Key": idempotencyKey }),
    json: { nin },
    timeoutMs: 30_000,
    schema: chauffeurOnboardingSchema,
  });
}

export function verifyChauffeurDriving({
  request,
  sessionToken,
  idempotencyKey,
  formData,
}: {
  readonly request: Request;
  readonly sessionToken: string;
  readonly idempotencyKey: string;
  readonly formData: FormData;
}) {
  return getApiClient().request({
    path: "/api/chauffeur-onboarding/driving-verifications",
    method: "POST",
    request,
    headers: bearerHeaders(sessionToken, { "Idempotency-Key": idempotencyKey }),
    formData,
    timeoutMs: 60_000,
    schema: chauffeurOnboardingSchema,
  });
}
