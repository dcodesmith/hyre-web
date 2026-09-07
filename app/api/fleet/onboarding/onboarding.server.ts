import { env } from "cloudflare:workers";

import { createApiClient } from "~/api/api.server";
import {
  fleetOwnerAccountVerificationSchema,
  fleetOwnerBanksSchema,
  fleetOwnerDriverLicenseReplacementSchema,
  fleetOwnerOnboardingSchema,
  fleetOwnerPhoneVerificationSchema,
} from "./schema";

let apiClient: ReturnType<typeof createApiClient> | undefined;

function getApiClient() {
  apiClient ??= createApiClient({ apiOrigin: env.API_ORIGIN });
  return apiClient;
}

export function getFleetOwnerBanks({ request }: { readonly request: Request }) {
  return getApiClient().request({
    path: "/api/fleet-owner/banks",
    request,
    forwardCookie: true,
    schema: fleetOwnerBanksSchema,
  });
}

export function getFleetOwnerOnboarding({ request }: { readonly request: Request }) {
  return getApiClient().request({
    path: "/api/fleet-owner/onboarding",
    request,
    forwardCookie: true,
    schema: fleetOwnerOnboardingSchema,
  });
}

export function sendFleetOwnerPhoneVerification({
  request,
  body,
}: {
  readonly request: Request;
  readonly body: { readonly phoneNumber: string };
}) {
  return getApiClient().request({
    path: "/api/fleet-owner/phone-verifications",
    method: "POST",
    request,
    forwardCookie: true,
    json: body,
    schema: fleetOwnerPhoneVerificationSchema,
  });
}

export function checkFleetOwnerPhoneVerification({
  request,
  body,
}: {
  readonly request: Request;
  readonly body: { readonly phoneNumber: string; readonly code: string };
}) {
  return getApiClient().request({
    path: "/api/fleet-owner/phone-verification-checks",
    method: "POST",
    request,
    forwardCookie: true,
    json: body,
    schema: fleetOwnerPhoneVerificationSchema,
  });
}

export function createFleetOwnerAccountVerification({
  request,
  idempotencyKey,
  formData,
}: {
  readonly request: Request;
  readonly idempotencyKey: string;
  readonly formData: FormData;
}) {
  return getApiClient().request({
    path: "/api/fleet-owner/account-verifications",
    method: "POST",
    request,
    forwardCookie: true,
    headers: { "Idempotency-Key": idempotencyKey },
    formData,
    schema: fleetOwnerAccountVerificationSchema,
  });
}

export function replaceFleetOwnerDriverLicense({
  request,
  file,
}: {
  readonly request: Request;
  readonly file: File;
}) {
  const formData = new FormData();
  formData.set("file", file);
  return getApiClient().request({
    path: "/api/fleet-owner/documents/drivers-license",
    method: "PUT",
    request,
    forwardCookie: true,
    formData,
    schema: fleetOwnerDriverLicenseReplacementSchema,
  });
}
