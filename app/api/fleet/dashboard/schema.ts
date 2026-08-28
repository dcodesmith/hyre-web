import { z } from "zod";

export const dashboardRangeSchema = z.enum(["7d", "30d", "90d"]);
export const dashboardGroupBySchema = z.enum(["day", "week", "month"]);

export const fleetDashboardOverviewSchema = z.object({
  totalBookings: z.number().int().nonnegative(),
  completedBookings: z.number().int().nonnegative(),
  activeBookings: z.number().int().nonnegative(),
  cancelledBookings: z.number().int().nonnegative(),
  carsCount: z.number().int().nonnegative(),
  ownerDriverTrips: z.number().int().nonnegative(),
  chauffeurTrips: z.number().int().nonnegative(),
  totalEarnings: z.number().nonnegative(),
  pendingPayoutAmount: z.number().nonnegative(),
});

const earningsBucketSchema = z.object({
  bucketStart: z.iso.datetime(),
  gross: z.number().nonnegative(),
  net: z.number().nonnegative(),
  fees: z.number().nonnegative(),
  refunds: z.number().nonnegative(),
  rides: z.number().int().nonnegative(),
});

export const fleetDashboardEarningsSchema = z.object({
  range: z.object({
    from: z.iso.datetime(),
    to: z.iso.datetime(),
    groupBy: dashboardGroupBySchema,
  }),
  totals: earningsBucketSchema.omit({ bucketStart: true }),
  series: z.array(earningsBucketSchema),
});

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
export type FleetDashboardEarnings = z.output<typeof fleetDashboardEarningsSchema>;
export type FleetDashboardOverview = z.output<typeof fleetDashboardOverviewSchema>;
export type DashboardGroupBy = z.output<typeof dashboardGroupBySchema>;
export type DashboardRange = z.output<typeof dashboardRangeSchema>;
export type PayoutStatus = z.output<typeof payoutStatusSchema>;
