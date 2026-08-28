import { z } from "zod";

import {
  type PayoutStatus,
  payoutStatusSchema,
  type RefundFilterStatus,
  refundFilterStatusSchema,
} from "~/api/admin/financials/schema";

export const FINANCIALS_PAGE_SIZE = 20;

type FinancialsViewBase = {
  readonly page: number;
  readonly attentionOnly: boolean;
};

export type FinancialsView =
  | (FinancialsViewBase & {
      readonly kind: "refunds";
      readonly status?: RefundFilterStatus;
    })
  | (FinancialsViewBase & {
      readonly kind: "payouts";
      readonly status?: PayoutStatus;
    });

export function parseFinancialsView(searchParams: URLSearchParams): FinancialsView {
  const kind = searchParams.get("type") === "payouts" ? "payouts" : "refunds";
  const page = z.coerce
    .number()
    .int()
    .positive()
    .catch(1)
    .parse(searchParams.get("page") ?? 1);
  const attentionOnly = searchParams.get("scope") !== "all";

  if (kind === "payouts") {
    const status = payoutStatusSchema.safeParse(searchParams.get("status"));
    return { kind, page, attentionOnly, status: status.success ? status.data : undefined };
  }

  const status = refundFilterStatusSchema.safeParse(searchParams.get("status"));
  return { kind, page, attentionOnly, status: status.success ? status.data : undefined };
}

export function serializeFinancialsView(view: FinancialsView) {
  const searchParams = new URLSearchParams();
  if (view.kind === "payouts") {
    searchParams.set("type", "payouts");
  }
  if (!view.attentionOnly) {
    searchParams.set("scope", "all");
  }
  if (view.status) {
    searchParams.set("status", view.status);
  }
  if (view.page > 1) {
    searchParams.set("page", String(view.page));
  }
  return searchParams;
}

export function adminFinancialsPath(view: FinancialsView) {
  const search = serializeFinancialsView(view).toString();
  return `/admin/financials${search ? `?${search}` : ""}`;
}

export function adminFinancialDetailPath(resourceId: string, view: FinancialsView) {
  const search = serializeFinancialsView(view).toString();
  const path = `/admin/financials/${view.kind}/${encodeURIComponent(resourceId)}`;
  return search ? `${path}?${search}` : path;
}
