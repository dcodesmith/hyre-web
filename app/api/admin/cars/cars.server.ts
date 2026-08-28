import { env } from "cloudflare:workers";

import { createApiClient } from "~/api/api.server";
import {
  type AdminCarApprovalStatus,
  adminCarMutationResponseSchema,
  adminCarSchema,
  adminCarsResponseSchema,
} from "./schema";

let apiClient: ReturnType<typeof createApiClient> | undefined;

function getApiClient() {
  apiClient ??= createApiClient({ apiOrigin: env.API_ORIGIN });
  return apiClient;
}

export function getAdminCars({
  request,
  approvalStatus,
  page,
  limit,
}: {
  readonly request: Request;
  readonly approvalStatus?: AdminCarApprovalStatus;
  readonly page: number;
  readonly limit: number;
}) {
  const searchParams = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (approvalStatus) {
    searchParams.set("approvalStatus", approvalStatus);
  }

  return getApiClient().request({
    path: `/api/admin/cars?${searchParams}`,
    request,
    forwardCookie: true,
    schema: adminCarsResponseSchema,
  });
}

export function getAdminCar({
  request,
  carId,
}: {
  readonly request: Request;
  readonly carId: string;
}) {
  return getApiClient().request({
    path: `/api/admin/cars/${encodeURIComponent(carId)}`,
    request,
    forwardCookie: true,
    schema: adminCarSchema,
  });
}

export function approveAdminCar({
  request,
  carId,
}: {
  readonly request: Request;
  readonly carId: string;
}) {
  return getApiClient().request({
    path: `/api/admin/cars/${encodeURIComponent(carId)}/approve`,
    method: "POST",
    request,
    forwardCookie: true,
    schema: adminCarMutationResponseSchema,
  });
}

export function setAdminCarCover({
  request,
  carId,
  imageId,
}: {
  readonly request: Request;
  readonly carId: string;
  readonly imageId: string;
}) {
  return getApiClient().request({
    path: `/api/admin/cars/${encodeURIComponent(carId)}/cover`,
    method: "PATCH",
    request,
    forwardCookie: true,
    json: { imageId },
    schema: adminCarMutationResponseSchema,
  });
}

export function approveAdminCarImage({
  request,
  carId,
  imageId,
}: {
  readonly request: Request;
  readonly carId: string;
  readonly imageId: string;
}) {
  return getApiClient().request({
    path: `/api/admin/cars/${encodeURIComponent(carId)}/images/${encodeURIComponent(imageId)}/approve`,
    method: "POST",
    request,
    forwardCookie: true,
    schema: adminCarMutationResponseSchema,
  });
}

export function rejectAdminCarImage({
  request,
  carId,
  imageId,
  notes,
}: {
  readonly request: Request;
  readonly carId: string;
  readonly imageId: string;
  readonly notes: string;
}) {
  return getApiClient().request({
    path: `/api/admin/cars/${encodeURIComponent(carId)}/images/${encodeURIComponent(imageId)}/reject`,
    method: "POST",
    request,
    forwardCookie: true,
    json: { notes },
    schema: adminCarMutationResponseSchema,
  });
}

export function approveAdminCarDocument({
  request,
  documentId,
}: {
  readonly request: Request;
  readonly documentId: string;
}) {
  return getApiClient().request({
    path: `/api/admin/documents/${encodeURIComponent(documentId)}/approve`,
    method: "POST",
    request,
    forwardCookie: true,
    schema: adminCarMutationResponseSchema,
  });
}

export function rejectAdminCarDocument({
  request,
  documentId,
  notes,
}: {
  readonly request: Request;
  readonly documentId: string;
  readonly notes: string;
}) {
  return getApiClient().request({
    path: `/api/admin/documents/${encodeURIComponent(documentId)}/reject`,
    method: "POST",
    request,
    forwardCookie: true,
    json: { notes },
    schema: adminCarMutationResponseSchema,
  });
}
