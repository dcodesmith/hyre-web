import { env } from "cloudflare:workers";

import { createApiClient } from "~/api/api.server";
import {
  type AdminStaffStatus,
  adminStaffListItemSchema,
  adminStaffListResponseSchema,
  adminStaffSchema,
} from "./schema";

let apiClient: ReturnType<typeof createApiClient> | undefined;

function getApiClient() {
  apiClient ??= createApiClient({ apiOrigin: env.API_ORIGIN });
  return apiClient;
}

export function createAdminStaff({
  request,
  body,
}: {
  readonly request: Request;
  readonly body: {
    readonly name: string;
    readonly email: string;
    readonly phoneNumber: string;
  };
}) {
  return getApiClient().request({
    path: "/api/admin/staff",
    method: "POST",
    request,
    forwardCookie: true,
    json: body,
    schema: adminStaffSchema,
  });
}

export function getAdminStaff({
  request,
  status,
  page,
  limit,
}: {
  readonly request: Request;
  readonly status?: AdminStaffStatus;
  readonly page: number;
  readonly limit: number;
}) {
  const searchParams = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (status) {
    searchParams.set("status", status);
  }

  return getApiClient().request({
    path: `/api/admin/staff?${searchParams}`,
    request,
    forwardCookie: true,
    schema: adminStaffListResponseSchema,
  });
}

function updateStaffAccess({
  request,
  staffId,
  action,
}: {
  readonly request: Request;
  readonly staffId: string;
  readonly action: "revoke" | "reinstate";
}) {
  return getApiClient().request({
    path: `/api/admin/staff/${encodeURIComponent(staffId)}/${action}`,
    method: "POST",
    request,
    forwardCookie: true,
    schema: adminStaffListItemSchema,
  });
}

export function revokeAdminStaff(request: Request, staffId: string) {
  return updateStaffAccess({ request, staffId, action: "revoke" });
}

export function reinstateAdminStaff(request: Request, staffId: string) {
  return updateStaffAccess({ request, staffId, action: "reinstate" });
}
