import {
  ArrowRightIcon,
  CalendarCheckIcon,
  CalendarClockIcon,
  CarIcon,
  CircleDollarSignIcon,
  TagIcon,
  WalletCardsIcon,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { Form, Link, useNavigation } from "react-router";

import type {
  DashboardGroupBy,
  DashboardRange,
  FleetDashboardEarnings,
  FleetDashboardOverview,
  FleetPayoutSummary,
} from "~/api/fleet/dashboard/schema";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { formatPayoutDate } from "~/fleet/payouts/payout";
import { formatCurrency } from "~/money/currency";
import { formatEarningsBucket } from "./dashboard";
import type { FleetDashboardView } from "./dashboard-url";

type DashboardOverview = Omit<
  FleetDashboardOverview,
  "chauffeurTrips" | "ownerDriverTrips" | "pendingPayoutAmount"
> & {
  readonly vehicleStatusCounts: {
    readonly available: number;
    readonly booked: number;
    readonly maintenance: number;
  } | null;
};
type DashboardEarnings = {
  readonly range: {
    readonly groupBy: DashboardGroupBy;
  };
  readonly totals: Pick<FleetDashboardEarnings["totals"], "fees" | "gross" | "net" | "rides">;
  readonly series: ReadonlyArray<
    Pick<FleetDashboardEarnings["series"][number], "bucketStart" | "net" | "rides">
  >;
};

type FleetDashboardPageProps = {
  readonly earnings: DashboardEarnings;
  readonly ownerName: string;
  readonly overview: DashboardOverview;
  readonly payoutSummary: Pick<FleetPayoutSummary, "lastPayoutAt" | "pendingPayouts">;
  readonly view: FleetDashboardView;
};

type OverviewCardProps = {
  readonly description: string;
  readonly details?: readonly string[];
  readonly icon: ReactNode;
  readonly title: string;
  readonly value: ReactNode;
};

function OverviewCard({ description, details, icon, title, value }: OverviewCardProps) {
  return (
    <Card className="@container/card bg-linear-to-t from-primary/5 to-card shadow-sm dark:bg-card">
      <CardHeader className="relative">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
          {value}
        </CardTitle>
        <span className="absolute top-4 right-4" aria-hidden="true">
          {icon}
        </span>
      </CardHeader>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <p className="text-sm text-muted-foreground">{description}</p>
        {details && details.length > 0 ? (
          <ul className="w-full space-y-1">
            {details.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        ) : null}
      </CardFooter>
    </Card>
  );
}

type EarningsMetricProps = {
  readonly label: string;
  readonly value: ReactNode;
};

function EarningsMetric({ label, value }: EarningsMetricProps) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

const RANGE_LABELS = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
} as const;

function RangeFilter({
  currentRange,
  isUpdating,
}: {
  readonly currentRange: DashboardRange;
  readonly isUpdating: boolean;
}) {
  const [selectedRange, setSelectedRange] = useState(currentRange);

  return (
    <Form method="get" action="/fleet-owner" className="flex items-end gap-2">
      <div className="grid min-w-40 gap-2">
        <Label htmlFor="dashboard-range">Period</Label>
        <Select
          name="range"
          value={selectedRange}
          onValueChange={(value) => setSelectedRange(value as DashboardRange)}
        >
          <SelectTrigger id="dashboard-range">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={isUpdating || selectedRange === currentRange}>
        {isUpdating ? "Updating…" : "Apply"}
      </Button>
    </Form>
  );
}

const QUICK_ACTIONS = [
  {
    description: "View and manage your vehicles",
    href: "/fleet-owner/cars",
    icon: CarIcon,
    label: "Manage Fleet",
  },
  {
    description: "Create and manage discounts",
    href: "/fleet-owner/promotions",
    icon: TagIcon,
    label: "Promotions",
  },
  {
    description: "Review payout transactions",
    href: "/fleet-owner/payout-transactions",
    icon: WalletCardsIcon,
    label: "Payout History",
  },
] as const;

export function FleetDashboardPage({
  earnings,
  ownerName,
  overview,
  payoutSummary,
  view,
}: FleetDashboardPageProps) {
  const navigation = useNavigation();
  const isUpdating =
    navigation.state !== "idle" &&
    navigation.formMethod === "GET" &&
    navigation.formAction != null &&
    new URL(navigation.formAction, "https://tripdly.com").pathname === "/fleet-owner";
  const activeBookingNoun = overview.activeBookings === 1 ? "booking" : "bookings";
  const activitySummary =
    overview.activeBookings > 0
      ? `You have ${overview.activeBookings} active ${activeBookingNoun} across your fleet.`
      : "Your fleet has no active bookings right now.";
  const fleetDetails = overview.vehicleStatusCounts
    ? [
        `${overview.vehicleStatusCounts.available} available`,
        `${overview.vehicleStatusCounts.maintenance} in maintenance`,
        `${overview.vehicleStatusCounts.booked} booked`,
      ]
    : ["Status breakdown unavailable"];

  return (
    <div className="@container/main mx-auto flex max-w-[1600px] flex-col gap-6 py-4 sm:py-6">
      <header className="space-y-2">
        <h2 className="text-xl font-bold tracking-tight md:text-2xl">Welcome back, {ownerName}</h2>
        <p className="text-sm text-muted-foreground md:text-base">{activitySummary}</p>
      </header>

      <section aria-labelledby="fleet-overview-heading">
        <h3 id="fleet-overview-heading" className="sr-only">
          Fleet overview
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <OverviewCard
            title="Fleet vehicles"
            value={overview.carsCount}
            description="Vehicles registered to your fleet"
            details={fleetDetails}
            icon={<CarIcon className="size-6 text-blue-600 dark:text-blue-400" />}
          />
          <OverviewCard
            title="Total bookings"
            value={overview.totalBookings}
            description="All bookings received"
            details={[
              `${overview.completedBookings} completed`,
              `${overview.cancelledBookings} cancelled`,
            ]}
            icon={<CalendarCheckIcon className="size-6 text-green-600 dark:text-green-400" />}
          />
          <OverviewCard
            title="Active bookings"
            value={overview.activeBookings}
            description="Bookings pending, confirmed, or in progress"
            icon={<CalendarClockIcon className="size-6 text-purple-600 dark:text-purple-400" />}
          />
          <OverviewCard
            title="Total earnings"
            value={formatCurrency(overview.totalEarnings)}
            description="Amount paid across payout records"
            icon={
              <CircleDollarSignIcon className="size-6 text-emerald-600 dark:text-emerald-400" />
            }
          />
        </div>
      </section>

      <section aria-labelledby="earnings-heading" aria-busy={isUpdating}>
        <output className="sr-only" aria-live="polite">
          {isUpdating ? "Updating earnings." : "Earnings updated."}
        </output>
        <Card className={isUpdating ? "opacity-60" : undefined}>
          <CardHeader className="gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 id="earnings-heading" className="font-heading text-base leading-snug font-medium">
                Earnings
              </h3>
              <CardDescription>{RANGE_LABELS[view.range]} performance</CardDescription>
            </div>
            <RangeFilter key={view.range} currentRange={view.range} isUpdating={isUpdating} />
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <EarningsMetric
              label="Gross booking value"
              value={formatCurrency(earnings.totals.gross)}
            />
            <EarningsMetric label="Net earnings" value={formatCurrency(earnings.totals.net)} />
            <EarningsMetric label="Platform fees" value={formatCurrency(earnings.totals.fees)} />
            <EarningsMetric label="Completed rides" value={earnings.totals.rides} />
          </CardContent>
        </Card>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section aria-labelledby="payout-overview-heading">
          <Card className="h-full bg-linear-to-t from-primary/5 to-card shadow-sm dark:bg-card">
            <CardHeader>
              <h3
                id="payout-overview-heading"
                className="flex items-center gap-2 font-heading text-lg font-semibold"
              >
                <WalletCardsIcon className="size-5" />
                Payout overview
              </h3>
              <CardDescription>
                {payoutSummary.pendingPayouts > 0
                  ? "Payout value currently awaiting completion"
                  : "No pending payouts at the moment"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <p className="text-3xl font-bold tabular-nums">
                {formatCurrency(payoutSummary.pendingPayouts)}
              </p>
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-muted-foreground">Last completed payout</span>
                <span className="font-medium">{formatPayoutDate(payoutSummary.lastPayoutAt)}</span>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to="/fleet-owner/payout-transactions">
                  View transactions
                  <ArrowRightIcon data-icon="inline-end" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </section>

        <section aria-labelledby="quick-actions-heading">
          <Card className="h-full shadow-sm">
            <CardHeader>
              <h3 id="quick-actions-heading" className="font-heading text-lg font-semibold">
                Quick actions
              </h3>
            </CardHeader>
            <CardContent className="grid gap-3">
              {QUICK_ACTIONS.map((action) => (
                <Button
                  key={action.href}
                  variant="secondary"
                  className="h-auto justify-start p-4 text-left"
                  asChild
                >
                  <Link to={action.href}>
                    <action.icon className="size-5" />
                    <span className="grid gap-0.5">
                      <span className="font-semibold">{action.label}</span>
                      <span className="text-xs font-normal text-muted-foreground">
                        {action.description}
                      </span>
                    </span>
                  </Link>
                </Button>
              ))}
            </CardContent>
          </Card>
        </section>
      </div>

      <section aria-labelledby="earnings-activity-heading" aria-busy={isUpdating}>
        <Card className={isUpdating ? "opacity-60" : undefined}>
          <CardHeader>
            <h3
              id="earnings-activity-heading"
              className="font-heading text-base leading-snug font-medium"
            >
              Earnings activity
            </h3>
            <CardDescription>Net earnings and completed rides by period</CardDescription>
          </CardHeader>
          <CardContent>
            {earnings.series.length === 0 ? (
              <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                No completed earnings activity for this period.
              </p>
            ) : (
              <ul className="divide-y" aria-label="Earnings by period">
                {earnings.series.map((bucket) => (
                  <li
                    key={bucket.bucketStart}
                    className="grid gap-2 py-4 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-8"
                  >
                    <p className="font-medium">
                      {formatEarningsBucket(bucket.bucketStart, earnings.range.groupBy)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {bucket.rides} completed {bucket.rides === 1 ? "ride" : "rides"}
                    </p>
                    <p className="font-semibold tabular-nums">{formatCurrency(bucket.net)}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
