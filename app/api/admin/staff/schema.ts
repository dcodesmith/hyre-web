import { z } from "zod";

export const adminStaffSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  email: z.email(),
  phoneNumber: z.string().nullable(),
  createdAt: z.iso.datetime(),
});

export const adminStaffStatusSchema = z.enum(["active", "revoked"]);
export type AdminStaffStatus = z.infer<typeof adminStaffStatusSchema>;

export const adminStaffListItemSchema = adminStaffSchema.extend({
  status: adminStaffStatusSchema,
  revokedAt: z.iso.datetime().nullable(),
});
export type AdminStaffListItem = z.infer<typeof adminStaffListItemSchema>;

export const adminStaffListResponseSchema = z.object({
  staff: z.array(adminStaffListItemSchema),
  meta: z.object({
    page: z.number().int(),
    limit: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  }),
});
export type AdminStaffListResponse = z.infer<typeof adminStaffListResponseSchema>;
