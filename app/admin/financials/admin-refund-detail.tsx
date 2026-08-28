import { ArrowLeftIcon, RefreshCcwIcon } from "lucide-react";
import { Link, useFetcher } from "react-router";
import type { AdminRefundDetail } from "~/api/admin/financials/schema";
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
import { Field, FieldDescription, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { formatCurrency } from "~/money/currency";
import type { FinancialActionData } from "./financial-action-schema";
import { FinancialAuditHistory, FinancialDetailItem, FinancialStatusBadge } from "./financials";
import { formatFinancialDateTime } from "./financials-format";
import { adminFinancialsPath, type FinancialsView } from "./financials-url";

function ReconcileRefund({ refund }: { readonly refund: AdminRefundDetail }) {
  const fetcher = useFetcher<FinancialActionData>();
  const formId = `reconcile-refund-${refund.id}`;

  return (
    <div className="space-y-3">
      <fetcher.Form id={formId} method="post">
        <input type="hidden" name="intent" value="reconcile-refund" />
      </fetcher.Form>
      {refund.canReconcile ? (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button disabled={fetcher.state !== "idle"}>
              <RefreshCcwIcon data-icon="inline-start" aria-hidden="true" />
              {fetcher.state === "idle" ? "Reconcile refund" : "Reconciling…"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reconcile this refund?</AlertDialogTitle>
              <AlertDialogDescription>
                The API will check the refund against Flutterwave and record this attempt.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {refund.refundProviderId ? (
              <p className="break-all rounded-md bg-muted p-3 text-sm">
                Provider reference: {refund.refundProviderId}
              </p>
            ) : (
              <Field>
                <FieldLabel htmlFor="refund-provider-id">Flutterwave refund ID</FieldLabel>
                <Input
                  id="refund-provider-id"
                  form={formId}
                  name="refundProviderId"
                  autoComplete="off"
                  spellCheck={false}
                  required
                />
                <FieldDescription>
                  Required because this refund has no stored provider reference.
                </FieldDescription>
              </Field>
            )}
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
          <AlertTitle>{fetcher.data.error ? "Refund not reconciled" : "Refund checked"}</AlertTitle>
          <AlertDescription>{fetcher.data.error ?? fetcher.data.success}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

export function AdminRefundDetailPage({
  refund,
  role,
  view,
}: {
  readonly refund: AdminRefundDetail;
  readonly role: AdminPortalRole;
  readonly view: FinancialsView;
}) {
  const source = refund.booking
    ? `Booking ${refund.booking.bookingReference}`
    : refund.extension
      ? `Extension ${refund.extension.id}`
      : "Unlinked payment";

  return (
    <section aria-labelledby="refund-heading" className="mx-auto max-w-5xl space-y-5">
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
            id="refund-heading"
            className="mt-1 break-all text-balance text-2xl font-semibold tracking-tight"
          >
            Refund <span translate="no">{refund.txRef}</span>
          </h2>
        </div>
        <FinancialStatusBadge status={refund.status} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {refund.refundRequestedAmount == null
              ? "Refund amount unavailable"
              : formatCurrency(refund.refundRequestedAmount, refund.currency)}
          </CardTitle>
          <CardDescription>Refund operation and provider state</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <FinancialDetailItem
              label="Amount charged"
              value={
                refund.amountCharged == null
                  ? "—"
                  : formatCurrency(refund.amountCharged, refund.currency)
              }
            />
            <FinancialDetailItem
              label="Requested"
              value={formatFinancialDateTime(refund.refundRequestedAt)}
            />
            <FinancialDetailItem
              label="Last checked"
              value={formatFinancialDateTime(refund.refundLastCheckedAt)}
            />
            <FinancialDetailItem
              label="Provider refund ID"
              value={refund.refundProviderId ?? "Not recorded"}
            />
            <FinancialDetailItem
              label="Provider status"
              value={refund.refundProviderStatus ?? "Not returned"}
            />
            <FinancialDetailItem
              label="Reconciliation attempts"
              value={refund.refundReconciliationAttempts}
            />
            <FinancialDetailItem
              label="Verification failures"
              value={refund.refundVerificationFailures}
            />
            <FinancialDetailItem
              label="Manual review notified"
              value={formatFinancialDateTime(refund.refundManualReviewNotifiedAt)}
            />
            <FinancialDetailItem
              label="Payment ID"
              value={<span translate="no">{refund.id}</span>}
            />
          </dl>
          {role === "admin" ? (
            <div className="mt-5">
              <ReconcileRefund refund={refund} />
            </div>
          ) : (
            <p className="mt-5 text-sm text-muted-foreground">
              You can review financial operations. Reconciliation requires an administrator.
            </p>
          )}
          {role === "admin" && !refund.canReconcile ? (
            <p className="mt-5 text-sm text-muted-foreground">
              The API marks this refund as unavailable for reconciliation.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <FinancialAuditHistory audits={refund.audits} />
    </section>
  );
}
