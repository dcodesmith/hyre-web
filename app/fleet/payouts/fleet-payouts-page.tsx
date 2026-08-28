import { CalendarClockIcon, CircleAlertIcon, Clock3Icon, WalletCardsIcon } from "lucide-react";
import { Form, Link, useNavigation } from "react-router";

import type { PayoutStatus } from "~/api/fleet/dashboard/schema";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
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
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { cn } from "~/lib/utils";
import { formatCurrency } from "~/money/currency";
import {
  type FleetPayoutRow,
  type FleetPayoutSummaryView,
  formatPayoutDate,
  PAYOUT_STATUS_CONFIG,
} from "./payout";
import { type FleetPayoutsView, fleetPayoutsPath, PAYOUT_PAGE_SIZE } from "./payouts-url";

type FleetPayoutsPageProps = {
  readonly payouts: FleetPayoutRow[];
  readonly summary: FleetPayoutSummaryView;
  readonly total: number;
  readonly view: FleetPayoutsView;
};

function PayoutStatusBadge({ status }: { readonly status: PayoutStatus }) {
  const config = PAYOUT_STATUS_CONFIG[status];

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

function SummaryCard({
  icon,
  label,
  value,
  detail,
}: {
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly value: string;
  readonly detail: string;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-muted-foreground">
          {icon}
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xl font-semibold tabular-nums">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function sourceLabel(payout: FleetPayoutRow) {
  if (payout.bookingId) {
    return `Booking ${payout.bookingId}`;
  }
  if (payout.extensionId) {
    return `Extension ${payout.extensionId}`;
  }
  return "—";
}

function PayoutCards({ payouts }: { readonly payouts: FleetPayoutRow[] }) {
  return (
    <div className="grid gap-3 md:hidden">
      {payouts.map((payout) => (
        <Card key={payout.id} size="sm">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center justify-between gap-2">
              <span className="min-w-0 truncate font-mono text-xs">{payout.id}</span>
              <PayoutStatusBadge status={payout.status} />
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-x-4 gap-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Amount due</p>
              <p className="font-semibold tabular-nums">
                {formatCurrency(payout.amountToPay, payout.currency)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Amount paid</p>
              <p className="font-semibold tabular-nums">
                {formatCurrency(payout.amountPaid, payout.currency)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Initiated</p>
              <p>{formatPayoutDate(payout.initiatedAt)}</p>
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Provider reference</p>
              <p className="truncate">{payout.payoutProviderReference ?? "—"}</p>
            </div>
            <div className="col-span-2 min-w-0">
              <p className="text-xs text-muted-foreground">Source</p>
              <p className="truncate">{sourceLabel(payout)}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function PayoutTable({ payouts }: { readonly payouts: FleetPayoutRow[] }) {
  return (
    <Card className="hidden py-0 md:block">
      <Table>
        <TableCaption className="sr-only">
          Fleet payout transactions initiated in the last 30 days
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Transaction ID</TableHead>
            <TableHead scope="col">Source</TableHead>
            <TableHead scope="col">Initiated</TableHead>
            <TableHead scope="col">Amount due</TableHead>
            <TableHead scope="col">Amount paid</TableHead>
            <TableHead scope="col">Status</TableHead>
            <TableHead scope="col">Provider reference</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payouts.map((payout) => (
            <TableRow key={payout.id}>
              <TableCell className="max-w-40 truncate font-mono text-xs">{payout.id}</TableCell>
              <TableCell className="max-w-48 truncate">{sourceLabel(payout)}</TableCell>
              <TableCell>{formatPayoutDate(payout.initiatedAt)}</TableCell>
              <TableCell className="tabular-nums">
                {formatCurrency(payout.amountToPay, payout.currency)}
              </TableCell>
              <TableCell className="tabular-nums">
                {formatCurrency(payout.amountPaid, payout.currency)}
              </TableCell>
              <TableCell>
                <PayoutStatusBadge status={payout.status} />
              </TableCell>
              <TableCell className="max-w-48 truncate">
                {payout.payoutProviderReference ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

export function FleetPayoutsPage({ payouts, summary, total, view }: FleetPayoutsPageProps) {
  const navigation = useNavigation();
  const isPending = navigation.state !== "idle";
  const totalPages = Math.max(1, Math.ceil(total / PAYOUT_PAGE_SIZE));

  return (
    <section aria-labelledby="payouts-heading" aria-busy={isPending} className="space-y-6">
      <div>
        <h2 id="payouts-heading" className="text-2xl font-semibold tracking-tight">
          Payout transactions
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Track recent disbursements and payout status.
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <h3 className="font-semibold">All-time summary</h3>
          <p className="text-sm text-muted-foreground">Totals across your full payout history.</p>
        </div>
        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            icon={<WalletCardsIcon className="size-4" aria-hidden="true" />}
            label="Total paid out"
            value={formatCurrency(summary.totalPaidOut)}
            detail={`${summary.paidOutCount} completed`}
          />
          <SummaryCard
            icon={<Clock3Icon className="size-4" aria-hidden="true" />}
            label="Pending payouts"
            value={formatCurrency(summary.pendingPayouts)}
            detail={`${summary.pendingCount} pending`}
          />
          <SummaryCard
            icon={<CircleAlertIcon className="size-4" aria-hidden="true" />}
            label="Failed payouts"
            value={formatCurrency(summary.failedPayouts)}
            detail={`${summary.failedCount} failed`}
          />
          <SummaryCard
            icon={<CalendarClockIcon className="size-4" aria-hidden="true" />}
            label="Last payout"
            value={formatPayoutDate(summary.lastPayoutAt)}
            detail="Most recent completion"
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="font-semibold">Recent payouts</h3>
          <p className="text-sm text-muted-foreground">
            Transactions initiated in the last 30 days.
          </p>
        </div>
        <Form method="get" className="flex items-end gap-2">
          <div className="space-y-1">
            <label htmlFor="payout-status" className="text-xs font-medium text-muted-foreground">
              Status
            </label>
            <Select key={view.status} name="status" defaultValue={view.status ?? "ALL"}>
              <SelectTrigger id="payout-status" className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                {Object.entries(PAYOUT_STATUS_CONFIG).map(([status, config]) => (
                  <SelectItem key={status} value={status}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" variant="outline" disabled={isPending}>
            {isPending ? "Applying…" : "Apply"}
          </Button>
        </Form>
      </div>

      {payouts.length > 0 ? (
        <>
          <PayoutCards payouts={payouts} />
          <PayoutTable payouts={payouts} />
        </>
      ) : (
        <Empty className="min-h-72 border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <WalletCardsIcon />
            </EmptyMedia>
            <EmptyTitle>No payouts found</EmptyTitle>
            <EmptyDescription>
              {view.status
                ? "No recent payouts match this status."
                : "Payouts initiated in the last 30 days will appear here."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Page {view.page} of {totalPages} · {total} transactions
        </p>
        <div className="flex gap-2">
          {view.page > 1 ? (
            <Button asChild variant="outline" size="sm">
              <Link to={fleetPayoutsPath({ ...view, page: view.page - 1 })}>Previous</Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              Previous
            </Button>
          )}
          {view.page < totalPages ? (
            <Button asChild variant="outline" size="sm">
              <Link to={fleetPayoutsPath({ ...view, page: view.page + 1 })}>Next</Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              Next
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
