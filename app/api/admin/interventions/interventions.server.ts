import { env } from "cloudflare:workers";

import { createApiClient } from "~/api/api.server";
import {
  interventionLicenseNumberSchema,
  interventionMutationSchema,
  verificationInterventionsSchema,
} from "./schema";

let apiClient: ReturnType<typeof createApiClient> | undefined;

function getApiClient() {
  apiClient ??= createApiClient({ apiOrigin: env.API_ORIGIN });
  return apiClient;
}

export function getVerificationInterventions({
  request,
  page,
  limit,
}: {
  request: Request;
  page: number;
  limit: number;
}) {
  const searchParams = new URLSearchParams({
    status: "OPEN",
    page: String(page),
    limit: String(limit),
  });
  return getApiClient().request({
    path: `/api/admin/verification-interventions?${searchParams}`,
    request,
    forwardCookie: true,
    schema: verificationInterventionsSchema,
  });
}

export function getInterventionLicenseNumber(request: Request, interventionId: string) {
  return getApiClient().request({
    path: `/api/admin/verification-interventions/${encodeURIComponent(interventionId)}/license-number`,
    request,
    forwardCookie: true,
    schema: interventionLicenseNumberSchema,
  });
}

export function getInterventionEvidence(
  request: Request,
  interventionId: string,
  evidence: "selfie" | "nin-portrait",
) {
  return getApiClient().requestRaw({
    path: `/api/admin/verification-interventions/${encodeURIComponent(interventionId)}/evidence/${evidence}`,
    request,
    forwardCookie: true,
    headers: { Accept: "image/*" },
  });
}

export function approveIntervention({
  request,
  interventionId,
  notes,
  source,
  authoritativeSourceAttested,
}: {
  request: Request;
  interventionId: string;
  notes: string;
  source: string;
  authoritativeSourceAttested: boolean;
}) {
  return getApiClient().request({
    path: `/api/admin/verification-interventions/${encodeURIComponent(interventionId)}/approve`,
    method: "POST",
    request,
    forwardCookie: true,
    json: { notes, source, authoritativeSourceAttested },
    schema: interventionMutationSchema,
  });
}

export function rejectIntervention(request: Request, interventionId: string, notes: string) {
  return getApiClient().request({
    path: `/api/admin/verification-interventions/${encodeURIComponent(interventionId)}/reject`,
    method: "POST",
    request,
    forwardCookie: true,
    json: { notes },
    schema: interventionMutationSchema,
  });
}

export function requestInterventionSelfieRetake(
  request: Request,
  interventionId: string,
  notes: string,
) {
  return getApiClient().request({
    path: `/api/admin/verification-interventions/${encodeURIComponent(interventionId)}/request-retake`,
    method: "POST",
    request,
    forwardCookie: true,
    json: { notes },
    schema: interventionMutationSchema,
  });
}

export function approveOwnerLicenseIntervention(request: Request, interventionId: string) {
  return getApiClient().request({
    path: `/api/admin/verification-interventions/${encodeURIComponent(interventionId)}/approve-document`,
    method: "POST",
    request,
    forwardCookie: true,
    schema: interventionMutationSchema,
  });
}
