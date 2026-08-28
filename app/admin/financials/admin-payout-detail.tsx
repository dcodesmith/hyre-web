import { ArrowLeftIcon, RefreshCcwIcon } from "lucide-react";
import { Link, useFetcher } from "react-router";

import type { AdminPayoutDetail } from "~/api/admin/financials/schema";
import type { AdminPortalRole } from "~/auth/auth-form-schema";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { formatCurrency } from "~/money/currency";
import type { FinancialActionData } from "./financial-action-schema";
import { FinancialAuditHistory, FinancialDetailItem, FinancialStatusBadge } from "./financials";
import { formatFinancialDateTime } from "./financials-format";
import { adminFinancialsPath, type FinancialsView } from "./financials-url";

function ReconcilePayout({
  canReconcile,
  payoutId,
}: {
  readonly canReconcile: boolean;
  readonly payoutId: string;
}) {
  const fetcher = useFetcher<FinancialActionData>();
  const formId = `reconcile-payout-${payoutId}`;

  return (
    <div className="space-y-3">
      <fetcher.Form id={formId} method="post">
        <input type="hidden" name="intent" value="reconcile-payout" />
      </fetcher.Form>
      {canReconcile ? (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button disabled={fetcher.state !== "idle"}>
              <RefreshCcwIcon data-icon="inline-start" aria-hidden="true" />
              {fetcher.state === "idle" ? "Reconcile payout" : "Reconciling…"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reconcile this payout?</AlertDialogTitle>
              <AlertDialogDescription>
                The API will check the payout against Flutterwave and record this attempt.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction type="submit" form={formId}>
                Reconcile
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
      {fetcher.state === "idle" && (fetcher.data?.error || fetcher.data?.success) ? (
        <Alert
          variant={fetcher.data.error ? "destructive" : "default"}
          role={fetcher.data.error ? "alert" : "status"}
          aria-live={fetcher.data.error ? "assertive" : "polite"}
        >
          <AlertTitle>{fetcher.data.error ? "Payout not reconciled" : "Payout checked"}</AlertTitle>
          <AlertDescription>{fetcher.data.error ?? fetcher.data.success}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

export function AdminPayoutDetailPage({
  payout,
  role,
  view,
}: {
  readonly payout: AdminPayoutDetail;
  readonly role: AdminPortalRole;
  readonly view: FinancialsView;
}) {
  const source = payout.booking
    ? `Booking ${payout.booking.bookingReference}`
    : payout.extensionId
      ? `Extension ${payout.extensionId}`
      : "Unlinked payout";
  const canReconcile = payout.status === "PROCESSING" && payout.payoutProviderReference !== null;

  return (
    <section aria-labelledby="payout-heading" className="mx-auto max-w-5xl space-y-5">
      <Button asChild size="sm" variant="ghost">
        <Link to={adminFinancialsPath(view)}>
          <ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
          Back to financials
        </Link>
      </Button>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{source}</p>
          <h2
            id="payout-heading"
            className="mt-1 break-all text-balance text-2xl font-semibold tracking-tight"
          >
            Payout <span translate="no">{payout.id}</span>
          </h2>
        </div>
        <FinancialStatusBadge status={payout.status} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{formatCurrency(payout.amountToPay, payout.currency)}</CardTitle>
          <CardDescription>Payout operation and provider state</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <FinancialDetailItem
              label="Amount paid"
              value={
                payout.amountPaid == null ? "—" : formatCurrency(payout.amountPaid, payout.currency)
              }
            />
            <FinancialDetailItem
              label="Initiated"
              value={formatFinancialDateTime(payout.initiatedAt)}
            />
            <FinancialDetailItem
              label="Processed"
              value={formatFinancialDateTime(payout.processedAt)}
            />
            <FinancialDetailItem
              label="Completed"
              value={formatFinancialDateTime(payout.completedAt)}
            />
            <FinancialDetailItem
              label="Provider reference"
              value={payout.payoutProviderReference ?? "Not recorded"}
            />
            <FinancialDetailItem
              label="Fleet owner"
              value={payout.fleetOwner.name ?? payout.fleetOwner.email}
            />
            <FinancialDetailItem label="Fleet owner email" value={payout.fleetOwner.email} />
            <FinancialDetailItem
              label="Payout method"
              value={payout.payoutMethodDetails ?? "Not recorded"}
            />
            <FinancialDetailItem label="Notes" value={payout.notes ?? "—"} />
          </dl>
          {role === "admin" ? (
            <div className="mt-5">
              <ReconcilePayout payoutId={payout.id} canReconcile={canReconcile} />
            </div>
          ) : (
            <p className="mt-5 text-sm text-muted-foreground">
              Staff can review financial operations. Reconciliation requires an administrator.
            </p>
          )}
          {role === "admin" && !canReconcile ? (
            <p className="mt-5 text-sm text-muted-foreground">
              Only processing payouts with a provider reference can be reconciled.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <FinancialAuditHistory audits={payout.audits} />
    </section>
  );
}
