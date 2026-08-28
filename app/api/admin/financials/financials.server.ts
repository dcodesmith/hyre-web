import { env } from "cloudflare:workers";

import { createApiClient } from "~/api/api.server";
import {
  adminPayoutDetailSchema,
  adminPayoutsSchema,
  adminRefundDetailSchema,
  adminRefundsSchema,
  type PayoutStatus,
  type RefundFilterStatus,
  reconcilePayoutResponseSchema,
  reconcileRefundResponseSchema,
} from "./schema";

let apiClient: ReturnType<typeof createApiClient> | undefined;

function getApiClient() {
  apiClient ??= createApiClient({ apiOrigin: env.API_ORIGIN });
  return apiClient;
}

type FinancialListRequest = {
  readonly request: Request;
  readonly attentionOnly: boolean;
  readonly page: number;
  readonly limit: number;
};

function listPath(
  resource: "payouts" | "refunds",
  query: {
    readonly attentionOnly: boolean;
    readonly page: number;
    readonly limit: number;
    readonly status?: string;
  },
) {
  const searchParams = new URLSearchParams({
    attentionOnly: String(query.attentionOnly),
    page: String(query.page),
    limit: String(query.limit),
  });
  if (query.status) {
    searchParams.set("status", query.status);
  }
  return `/api/admin/financial-operations/${resource}?${searchParams}`;
}

export function getAdminRefunds({
  request,
  attentionOnly,
  page,
  limit,
  status,
}: FinancialListRequest & { readonly status?: RefundFilterStatus }) {
  return getApiClient().request({
    path: listPath("refunds", { attentionOnly, page, limit, status }),
    request,
    forwardCookie: true,
    schema: adminRefundsSchema,
  });
}

export function getAdminRefund({
  request,
  paymentId,
}: {
  readonly request: Request;
  readonly paymentId: string;
}) {
  return getApiClient().request({
    path: `/api/admin/financial-operations/refunds/${encodeURIComponent(paymentId)}`,
    request,
    forwardCookie: true,
    schema: adminRefundDetailSchema,
  });
}

export function reconcileAdminRefund({
  request,
  paymentId,
  refundProviderId,
}: {
  readonly request: Request;
  readonly paymentId: string;
  readonly refundProviderId?: string;
}) {
  return getApiClient().request({
    path: `/api/admin/financial-operations/refunds/${encodeURIComponent(paymentId)}/reconcile`,
    method: "POST",
    request,
    forwardCookie: true,
    json: refundProviderId ? { refundProviderId } : {},
    schema: reconcileRefundResponseSchema,
  });
}

export function getAdminPayouts({
  request,
  attentionOnly,
  page,
  limit,
  status,
}: FinancialListRequest & { readonly status?: PayoutStatus }) {
  return getApiClient().request({
    path: listPath("payouts", { attentionOnly, page, limit, status }),
    request,
    forwardCookie: true,
    schema: adminPayoutsSchema,
  });
}

export function getAdminPayout({
  request,
  payoutTransactionId,
}: {
  readonly request: Request;
  readonly payoutTransactionId: string;
}) {
  return getApiClient().request({
    path: `/api/admin/financial-operations/payouts/${encodeURIComponent(payoutTransactionId)}`,
    request,
    forwardCookie: true,
    schema: adminPayoutDetailSchema,
  });
}

export function reconcileAdminPayout({
  request,
  payoutTransactionId,
}: {
  readonly request: Request;
  readonly payoutTransactionId: string;
}) {
  return getApiClient().request({
    path: `/api/admin/financial-operations/payouts/${encodeURIComponent(payoutTransactionId)}/reconcile`,
    method: "POST",
    request,
    forwardCookie: true,
    schema: reconcilePayoutResponseSchema,
  });
}
