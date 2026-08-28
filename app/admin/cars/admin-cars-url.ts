import { z } from "zod";

import { adminCarApprovalStatusSchema } from "~/api/admin/cars/schema";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const adminCarsQuerySchema = z.object({
  approvalStatus: adminCarApprovalStatusSchema.optional().catch(undefined),
  page: z.coerce.number().int().positive().catch(DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).catch(DEFAULT_LIMIT),
});

export type AdminCarsQuery = Readonly<z.output<typeof adminCarsQuerySchema>>;

export function parseAdminCarsQuery(searchParams: URLSearchParams): AdminCarsQuery {
  return adminCarsQuerySchema.parse(Object.fromEntries(searchParams));
}

export function serializeAdminCarsQuery(query: AdminCarsQuery) {
  const searchParams = new URLSearchParams();
  if (query.approvalStatus) {
    searchParams.set("approvalStatus", query.approvalStatus);
  }
  if (query.page > DEFAULT_PAGE) {
    searchParams.set("page", String(query.page));
  }
  if (query.limit !== DEFAULT_LIMIT) {
    searchParams.set("limit", String(query.limit));
  }
  return searchParams;
}
