import { z } from "zod";

import { adminCarApprovalStatusSchema } from "~/api/admin/cars/schema";

const adminCarsQuerySchema = z.object({
  approvalStatus: adminCarApprovalStatusSchema.optional().catch(undefined),
  page: z.coerce.number().int().positive().catch(1),
  limit: z.coerce.number().int().min(1).max(100).catch(20),
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
  if (query.page > 1) {
    searchParams.set("page", String(query.page));
  }
  if (query.limit !== 20) {
    searchParams.set("limit", String(query.limit));
  }
  return searchParams;
}
