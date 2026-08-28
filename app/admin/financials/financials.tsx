import type {
  AdminFinancialAudit,
  PayoutStatus,
  RefundStatus,
} from "~/api/admin/financials/schema";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { cn } from "~/lib/utils";
import { formatFinancialDateTime } from "./financials-format";

const statusConfig: Readonly<
  Record<PayoutStatus | RefundStatus, { label: string; className: string }>
> = {
  SUCCESSFUL: {
    label: "Payment successful",
    className: "bg-green-50 text-green-700 ring-green-600/10",
  },
  REFUND_PROCESSING: {
    label: "Refund processing",
    className: "bg-indigo-50 text-indigo-700 ring-indigo-600/10",
  },
  REFUND_ERROR: { label: "Refund error", className: "bg-red-50 text-red-700 ring-red-600/10" },
  REFUNDED: { label: "Refunded", className: "bg-green-50 text-green-700 ring-green-600/10" },
  PARTIALLY_REFUNDED: {
    label: "Partially refunded",
    className: "bg-yellow-50 text-yellow-700 ring-yellow-600/10",
  },
  REFUND_FAILED: {
    label: "Refund failed",
    className: "bg-red-50 text-red-700 ring-red-600/10",
  },
  PENDING_APPROVAL: {
    label: "Pending approval",
    className: "bg-yellow-50 text-yellow-700 ring-yellow-600/10",
  },
  PENDING_DISBURSEMENT: {
    label: "Pending disbursement",
    className: "bg-blue-50 text-blue-700 ring-blue-600/10",
  },
  PROCESSING: {
    label: "Processing",
    className: "bg-indigo-50 text-indigo-700 ring-indigo-600/10",
  },
  PAID_OUT: { label: "Paid out", className: "bg-green-50 text-green-700 ring-green-600/10" },
  FAILED: { label: "Failed", className: "bg-red-50 text-red-700 ring-red-600/10" },
  REVERSED: { label: "Reversed", className: "bg-purple-50 text-purple-700 ring-purple-600/10" },
};

const auditConfig: Readonly<
  Record<AdminFinancialAudit["outcome"], { label: string; className: string }>
> = {
  STARTED: { label: "Started", className: "bg-blue-50 text-blue-700 ring-blue-600/10" },
  RECONCILED: {
    label: "Reconciled",
    className: "bg-green-50 text-green-700 ring-green-600/10",
  },
  UNRESOLVED: {
    label: "Unresolved",
    className: "bg-yellow-50 text-yellow-700 ring-yellow-600/10",
  },
  FAILED: { label: "Failed", className: "bg-red-50 text-red-700 ring-red-600/10" },
};

export function FinancialStatusBadge({ status }: { readonly status: PayoutStatus | RefundStatus }) {
  const config = statusConfig[status];
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-6 rounded-md border-none px-2.5 font-semibold ring-1 ring-inset",
        config.className,
      )}
    >
      {config.label}
    </Badge>
  );
}

export function FinancialDetailItem({
  label,
  value,
}: {
  readonly label: string;
  readonly value: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words font-medium tabular-nums">{value}</dd>
    </div>
  );
}

export function FinancialAuditHistory({
  audits,
}: {
  readonly audits: readonly AdminFinancialAudit[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Reconciliation history</CardTitle>
      </CardHeader>
      <CardContent>
        {audits.length > 0 ? (
          <ol className="divide-y">
            {audits.map((audit) => {
              const config = auditConfig[audit.outcome];
              return (
                <li key={audit.id} className="grid gap-2 py-4 first:pt-0 last:pb-0 sm:grid-cols-3">
                  <div>
                    <Badge
                      variant="outline"
                      className={cn("border-none ring-1 ring-inset", config.className)}
                    >
                      {config.label}
                    </Badge>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {formatFinancialDateTime(audit.createdAt)}
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="break-all text-sm">
                      Provider reference:{" "}
                      <span translate="no">{audit.providerReference ?? "Not recorded"}</span>
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Provider status: {audit.providerStatus ?? "Not returned"}
                    </p>
                    <p className="mt-1 break-all text-sm text-muted-foreground">
                      Operator: <span translate="no">{audit.actorUserId}</span>
                    </p>
                    {audit.error ? (
                      <p className="mt-1 text-sm text-destructive">{audit.error}</p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">No reconciliation attempts yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
