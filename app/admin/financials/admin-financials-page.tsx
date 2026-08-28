import {
  BanknoteArrowDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EyeIcon,
  WalletCardsIcon,
} from "lucide-react";
import { Form, Link, useNavigation } from "react-router";

import type {
  AdminPayout,
  AdminRefund,
  PayoutStatus,
  RefundFilterStatus,
} from "~/api/admin/financials/schema";
import { Button } from "~/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { formatCurrency } from "~/money/currency";
import { FinancialStatusBadge } from "./financials";
import { formatFinancialDateTime } from "./financials-format";
import {
  adminFinancialDetailPath,
  adminFinancialsPath,
  type FinancialsView,
} from "./financials-url";

const refundStatuses: readonly { value: RefundFilterStatus; label: string }[] = [
  { value: "REFUND_PROCESSING", label: "Refund processing" },
  { value: "REFUND_ERROR", label: "Refund error" },
  { value: "REFUNDED", label: "Refunded" },
  { value: "PARTIALLY_REFUNDED", label: "Partially refunded" },
  { value: "REFUND_FAILED", label: "Refund failed" },
];

const payoutStatuses: readonly { value: PayoutStatus; label: string }[] = [
  { value: "PENDING_APPROVAL", label: "Pending approval" },
  { value: "PENDING_DISBURSEMENT", label: "Pending disbursement" },
  { value: "PROCESSING", label: "Processing" },
  { value: "PAID_OUT", label: "Paid out" },
  { value: "FAILED", label: "Failed" },
  { value: "REVERSED", label: "Reversed" },
];

type AdminFinancialsPageProps = {
  readonly view: FinancialsView;
  readonly items: readonly (AdminRefund | AdminPayout)[];
  readonly meta: FinancialMeta;
};

type FinancialMeta = {
  readonly page: number;
  readonly total: number;
  readonly totalPages: number;
};

function sourceLabel(item: AdminRefund | AdminPayout) {
  if ("txRef" in item) {
    if (item.booking) {
      return `Booking ${item.booking.bookingReference}`;
    }
    if (item.extension) {
      return `Extension ${item.extension.id}`;
    }
    return item.txRef;
  }
  if (item.booking) {
    return `Booking ${item.booking.bookingReference}`;
  }
  if (item.extensionId) {
    return `Extension ${item.extensionId}`;
  }
  return "—";
}

function primaryAmount(item: AdminRefund | AdminPayout) {
  return "txRef" in item ? item.refundRequestedAmount : item.amountToPay;
}

function primaryDate(item: AdminRefund | AdminPayout) {
  return "txRef" in item ? item.refundRequestedAt : item.initiatedAt;
}

function FinancialCards({
  items,
  view,
}: {
  readonly items: readonly (AdminRefund | AdminPayout)[];
  readonly view: FinancialsView;
}) {
  return (
    <div className="grid gap-3 md:hidden">
      {items.map((item) => (
        <Link
          key={item.id}
          to={adminFinancialDetailPath(item.id, view)}
          className="rounded-xl border bg-card p-4 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-medium">{sourceLabel(item)}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatFinancialDateTime(primaryDate(item))}
              </p>
            </div>
            <FinancialStatusBadge status={item.status} />
          </div>
          <p className="mt-4 text-lg font-semibold tabular-nums">
            {primaryAmount(item) == null
              ? "Amount unavailable"
              : formatCurrency(primaryAmount(item) ?? 0, item.currency)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground" translate="no">
            {"txRef" in item ? item.txRef : (item.fleetOwner.name ?? item.fleetOwner.email)}
          </p>
        </Link>
      ))}
    </div>
  );
}

function FinancialTable({
  items,
  view,
}: {
  readonly items: readonly (AdminRefund | AdminPayout)[];
  readonly view: FinancialsView;
}) {
  return (
    <div className="hidden overflow-hidden rounded-lg border md:block">
      <Table>
        <caption className="sr-only">
          {view.kind === "refunds" ? "Refund operations" : "Payout operations"}
        </caption>
        <TableHeader>
          <TableRow>
            <TableHead>Source</TableHead>
            <TableHead>{view.kind === "refunds" ? "Transaction" : "Fleet owner"}</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>{view.kind === "refunds" ? "Requested" : "Initiated"}</TableHead>
            <TableHead>
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">{sourceLabel(item)}</TableCell>
              <TableCell className="max-w-48 truncate" translate="no">
                {"txRef" in item ? item.txRef : (item.fleetOwner.name ?? item.fleetOwner.email)}
              </TableCell>
              <TableCell className="tabular-nums">
                {primaryAmount(item) == null
                  ? "—"
                  : formatCurrency(primaryAmount(item) ?? 0, item.currency)}
              </TableCell>
              <TableCell>
                <FinancialStatusBadge status={item.status} />
              </TableCell>
              <TableCell>{formatFinancialDateTime(primaryDate(item))}</TableCell>
              <TableCell className="text-right">
                <Button asChild size="sm" variant="ghost">
                  <Link
                    to={adminFinancialDetailPath(item.id, view)}
                    aria-label={`View ${view.kind === "refunds" ? "refund" : "payout"} ${sourceLabel(item)}`}
                  >
                    <EyeIcon data-icon="inline-start" aria-hidden="true" />
                    View
                  </Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function FinancialPagination({
  meta,
  view,
}: {
  readonly meta: FinancialMeta;
  readonly view: FinancialsView;
}) {
  if (meta.totalPages <= 1) {
    return null;
  }

  return (
    <nav
      aria-label="Financial operations pagination"
      className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-end"
    >
      <p className="text-center text-sm text-muted-foreground sm:text-left">
        Page {meta.page} of {meta.totalPages} · {meta.total} records
      </p>
      <div className="grid grid-cols-2 gap-2 sm:flex">
        {meta.page > 1 ? (
          <Button asChild size="sm" variant="outline">
            <Link to={adminFinancialsPath({ ...view, page: meta.page - 1 })}>
              <ChevronLeftIcon data-icon="inline-start" aria-hidden="true" />
              Previous
            </Link>
          </Button>
        ) : (
          <Button disabled size="sm" variant="outline">
            <ChevronLeftIcon data-icon="inline-start" aria-hidden="true" />
            Previous
          </Button>
        )}
        {meta.page < meta.totalPages ? (
          <Button asChild size="sm" variant="outline">
            <Link to={adminFinancialsPath({ ...view, page: meta.page + 1 })}>
              Next
              <ChevronRightIcon data-icon="inline-end" aria-hidden="true" />
            </Link>
          </Button>
        ) : (
          <Button disabled size="sm" variant="outline">
            Next
            <ChevronRightIcon data-icon="inline-end" aria-hidden="true" />
          </Button>
        )}
      </div>
    </nav>
  );
}

export function AdminFinancialsPage(props: AdminFinancialsPageProps) {
  const navigation = useNavigation();
  const { items, meta, view } = props;
  const statuses = view.kind === "refunds" ? refundStatuses : payoutStatuses;
  const isPending = navigation.state !== "idle";

  return (
    <section aria-labelledby="financials-heading" aria-busy={isPending} className="space-y-5">
      <div>
        <h2 id="financials-heading" className="text-balance text-2xl font-semibold tracking-tight">
          Financials
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Review refunds and payouts that may need provider reconciliation.
        </p>
      </div>

      <nav className="flex gap-2" aria-label="Financial operation type">
        <Button asChild size="sm" variant={view.kind === "refunds" ? "default" : "outline"}>
          <Link
            to={adminFinancialsPath({
              kind: "refunds",
              attentionOnly: view.attentionOnly,
              page: 1,
            })}
            aria-current={view.kind === "refunds" ? "page" : undefined}
          >
            <BanknoteArrowDownIcon data-icon="inline-start" aria-hidden="true" />
            Refunds
          </Link>
        </Button>
        <Button asChild size="sm" variant={view.kind === "payouts" ? "default" : "outline"}>
          <Link
            to={adminFinancialsPath({
              kind: "payouts",
              attentionOnly: view.attentionOnly,
              page: 1,
            })}
            aria-current={view.kind === "payouts" ? "page" : undefined}
          >
            <WalletCardsIcon data-icon="inline-start" aria-hidden="true" />
            Payouts
          </Link>
        </Button>
      </nav>

      <Form
        method="get"
        className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[minmax(0,16rem)_minmax(0,16rem)_auto] sm:items-end"
      >
        {view.kind === "payouts" ? <input type="hidden" name="type" value="payouts" /> : null}
        <label htmlFor="financial-scope" className="grid gap-1.5 text-sm">
          <span className="font-medium">Queue</span>
          <Select
            key={view.attentionOnly ? "attention" : "all"}
            name="scope"
            autoComplete="off"
            defaultValue={view.attentionOnly ? "attention" : "all"}
          >
            <SelectTrigger id="financial-scope" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="attention">Needs attention</SelectItem>
              <SelectItem value="all">All records</SelectItem>
            </SelectContent>
          </Select>
        </label>
        <label htmlFor="financial-status" className="grid gap-1.5 text-sm">
          <span className="font-medium">Status</span>
          <Select
            key={`${view.kind}-${view.status}`}
            name="status"
            autoComplete="off"
            defaultValue={view.status ?? "ALL"}
          >
            <SelectTrigger id="financial-status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              {statuses.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <Button
          type="submit"
          variant="outline"
          disabled={isPending}
          className="sm:justify-self-start"
        >
          {isPending ? "Applying…" : "Apply filters"}
        </Button>
      </Form>

      {items.length > 0 ? (
        <>
          <FinancialCards items={items} view={view} />
          <FinancialTable items={items} view={view} />
          <FinancialPagination meta={meta} view={view} />
        </>
      ) : (
        <Empty className="min-h-80 border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              {view.kind === "refunds" ? (
                <BanknoteArrowDownIcon aria-hidden="true" />
              ) : (
                <WalletCardsIcon aria-hidden="true" />
              )}
            </EmptyMedia>
            <EmptyTitle>No {view.kind} found</EmptyTitle>
            <EmptyDescription>
              {view.attentionOnly
                ? `There are no ${view.kind} that need attention.`
                : `No ${view.kind} match these filters.`}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </section>
  );
}
