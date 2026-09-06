import { z } from "zod";

import { adminStaffStatusSchema } from "~/api/admin/staff/schema";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

const staffQuerySchema = z.object({
  status: adminStaffStatusSchema.optional().catch(undefined),
  page: z.coerce.number().int().positive().catch(DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(100).catch(DEFAULT_LIMIT),
});

export type StaffQuery = Readonly<z.output<typeof staffQuerySchema>>;

export function parseStaffQuery(searchParams: URLSearchParams): StaffQuery {
  return staffQuerySchema.parse(Object.fromEntries(searchParams));
}

export function serializeStaffQuery(query: StaffQuery) {
  const searchParams = new URLSearchParams();
  if (query.status) {
    searchParams.set("status", query.status);
  }
  if (query.page > DEFAULT_PAGE) {
    searchParams.set("page", String(query.page));
  }
  if (query.limit !== DEFAULT_LIMIT) {
    searchParams.set("limit", String(query.limit));
  }
  return searchParams;
}

export function isAddStaffOpen(searchParams: URLSearchParams) {
  return searchParams.get("add") === "1";
}

export function staffHref(query: StaffQuery, options?: { readonly add?: boolean }) {
  const searchParams = serializeStaffQuery(query);
  if (options?.add) {
    searchParams.set("add", "1");
  }
  const search = searchParams.toString();
  return search ? `/admin/staff?${search}` : "/admin/staff";
}
