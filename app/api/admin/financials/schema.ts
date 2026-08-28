import { z } from "zod";

export const refundStatusSchema = z.enum([
  "SUCCESSFUL",
  "REFUND_PROCESSING",
  "REFUND_ERROR",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
  "REFUND_FAILED",
]);

export const refundFilterStatusSchema = refundStatusSchema.exclude(["SUCCESSFUL"]);

export const payoutStatusSchema = z.enum([
  "PENDING_APPROVAL",
  "PENDING_DISBURSEMENT",
  "PROCESSING",
  "PAID_OUT",
  "FAILED",
  "REVERSED",
]);

const paginationMetaSchema = z.object({
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});

const auditSchema = z.object({
  id: z.string(),
  actorUserId: z.string(),
  outcome: z.enum(["STARTED", "RECONCILED", "UNRESOLVED", "FAILED"]),
  providerReference: z.string().nullable(),
  providerStatus: z.string().nullable(),
  error: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const adminRefundSchema = z.object({
  id: z.string(),
  txRef: z.string(),
  status: refundStatusSchema,
  amountCharged: z.number().nullable(),
  refundRequestedAmount: z.number().nullable(),
  currency: z.string().length(3),
  refundProviderId: z.string().nullable(),
  refundProviderStatus: z.string().nullable(),
  refundRequestedAt: z.iso.datetime().nullable(),
  refundLastCheckedAt: z.iso.datetime().nullable(),
  refundReconciliationAttempts: z.number().int().nonnegative(),
  refundVerificationFailures: z.number().int().nonnegative(),
  refundManualReviewNotifiedAt: z.iso.datetime().nullable(),
  canReconcile: z.boolean(),
  booking: z
    .object({
      id: z.string(),
      bookingReference: z.string(),
    })
    .nullable(),
  extension: z
    .object({
      id: z.string(),
      paymentStatus: z.string(),
    })
    .nullable(),
});

export const adminRefundsSchema = z.object({
  refunds: z.array(adminRefundSchema),
  meta: paginationMetaSchema,
});

export const adminRefundDetailSchema = adminRefundSchema.extend({
  audits: z.array(auditSchema),
});

export const reconcileRefundResponseSchema = z.object({
  reconciled: z.boolean(),
  status: refundStatusSchema,
  providerStatus: z.string().nullable(),
  refund: adminRefundSchema,
});

export const adminPayoutSchema = z.object({
  id: z.string(),
  status: payoutStatusSchema,
  fleetOwner: z.object({
    id: z.string(),
    name: z.string().nullable(),
    email: z.email(),
  }),
  booking: z
    .object({
      id: z.string(),
      bookingReference: z.string(),
      overallPayoutStatus: payoutStatusSchema.nullable(),
    })
    .nullable(),
  extensionId: z.string().nullable(),
  amountToPay: z.number(),
  amountPaid: z.number().nullable(),
  currency: z.string().length(3),
  payoutProviderReference: z.string().nullable(),
  payoutMethodDetails: z.string().nullable(),
  initiatedAt: z.iso.datetime(),
  processedAt: z.iso.datetime().nullable(),
  completedAt: z.iso.datetime().nullable(),
  notes: z.string().nullable(),
});

export const adminPayoutsSchema = z.object({
  payouts: z.array(adminPayoutSchema),
  meta: paginationMetaSchema,
});

export const adminPayoutDetailSchema = adminPayoutSchema.extend({
  audits: z.array(auditSchema),
});

export const reconcilePayoutResponseSchema = z.object({
  reconciled: z.boolean(),
  status: payoutStatusSchema,
  providerStatus: z.string().nullable(),
  mismatchReason: z.string().nullable().optional(),
  payout: adminPayoutSchema,
});

export type AdminFinancialAudit = z.output<typeof auditSchema>;
export type AdminPayout = z.output<typeof adminPayoutSchema>;
export type AdminPayoutDetail = z.output<typeof adminPayoutDetailSchema>;
export type AdminRefund = z.output<typeof adminRefundSchema>;
export type AdminRefundDetail = z.output<typeof adminRefundDetailSchema>;
export type PayoutStatus = z.output<typeof payoutStatusSchema>;
export type RefundFilterStatus = z.output<typeof refundFilterStatusSchema>;
export type RefundStatus = z.output<typeof refundStatusSchema>;
