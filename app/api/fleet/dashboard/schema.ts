import { z } from "zod";

export const payoutStatusSchema = z.enum([
  "PENDING_APPROVAL",
  "PENDING_DISBURSEMENT",
  "PROCESSING",
  "PAID_OUT",
  "FAILED",
  "REVERSED",
]);

const payoutStatusSummarySchema = z.object({
  count: z.number().int().nonnegative(),
  amountToPay: z.number().nonnegative(),
  amountPaid: z.number().nonnegative(),
});

export const fleetPayoutSchema = z.object({
  id: z.string(),
  amountToPay: z.number().nonnegative(),
  amountPaid: z.number().nonnegative(),
  currency: z.string().length(3),
  status: payoutStatusSchema,
  payoutProviderReference: z.string().nullable(),
  initiatedAt: z.iso.datetime(),
  processedAt: z.iso.datetime().nullable(),
  completedAt: z.iso.datetime().nullable(),
  notes: z.string().nullable(),
  bookingId: z.string().nullable(),
  extensionId: z.string().nullable(),
});

export const fleetPayoutsSchema = z.object({
  page: z.number().int().positive(),
  limit: z.number().int().min(1).max(100),
  total: z.number().int().nonnegative(),
  items: z.array(fleetPayoutSchema),
});

export const fleetPayoutSummarySchema = z.object({
  totalPaidOut: z.number().nonnegative(),
  pendingPayouts: z.number().nonnegative(),
  failedPayouts: z.number().nonnegative(),
  lastPayoutAt: z.iso.datetime().nullable(),
  statusBreakdown: z.record(payoutStatusSchema, payoutStatusSummarySchema),
});

export type FleetPayout = z.output<typeof fleetPayoutSchema>;
export type FleetPayoutSummary = z.output<typeof fleetPayoutSummarySchema>;
export type PayoutStatus = z.output<typeof payoutStatusSchema>;
