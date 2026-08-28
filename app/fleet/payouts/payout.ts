import type { FleetPayout, FleetPayoutSummary, PayoutStatus } from "~/api/fleet/dashboard/schema";
import { SERVICE_TIMEZONE } from "~/time/timezone";

export const PAYOUT_STATUS_CONFIG: Readonly<
  Record<PayoutStatus, { label: string; className: string }>
> = {
  PENDING_APPROVAL: {
    label: "Pending Approval",
    className: "bg-yellow-50 text-yellow-700 ring-yellow-600/10",
  },
  PENDING_DISBURSEMENT: {
    label: "Pending Disbursement",
    className: "bg-blue-50 text-blue-700 ring-blue-600/10",
  },
  PROCESSING: {
    label: "Processing",
    className: "bg-indigo-50 text-indigo-700 ring-indigo-600/10",
  },
  PAID_OUT: { label: "Paid Out", className: "bg-green-50 text-green-700 ring-green-600/10" },
  FAILED: { label: "Failed", className: "bg-red-50 text-red-700 ring-red-600/10" },
  REVERSED: { label: "Reversed", className: "bg-purple-50 text-purple-700 ring-purple-600/10" },
};

export type FleetPayoutRow = Omit<FleetPayout, "processedAt" | "completedAt" | "notes">;

export type FleetPayoutSummaryView = Pick<
  FleetPayoutSummary,
  "totalPaidOut" | "pendingPayouts" | "failedPayouts" | "lastPayoutAt"
> & {
  readonly paidOutCount: number;
  readonly pendingCount: number;
  readonly failedCount: number;
};

const payoutDateFormatter = new Intl.DateTimeFormat("en-NG", {
  timeZone: SERVICE_TIMEZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function formatPayoutDate(value: string | null) {
  return value ? payoutDateFormatter.format(new Date(value)) : "—";
}
