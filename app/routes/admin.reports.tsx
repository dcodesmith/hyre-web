import { BookingAcquisitionChannel, PaymentStatus } from "@prisma/client";
import { Link, type LoaderFunctionArgs, data, useLoaderData } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { requireAdminOrStaffWithRedirect } from "~/modules/auth/auth.server";
import { prisma } from "~/modules/db/db.server";

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function toInputDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function atStartOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function atEndOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function parseDateInput(input: string | null, mode: "start" | "end"): Date | null {
  if (!input || !DATE_ONLY_REGEX.test(input)) return null;
  const parsed = new Date(`${input}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return mode === "start" ? atStartOfDay(parsed) : atEndOfDay(parsed);
}

function getDefaultDateRange(): { from: Date; to: Date } {
  const to = atEndOfDay(new Date());
  const from = new Date(to);
  from.setDate(from.getDate() - 29);
  return { from: atStartOfDay(from), to };
}

function toNumber(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asPercent(part: number, total: number): number {
  if (total <= 0) return 0;
  return (part / total) * 100;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

type ChannelRow = {
  channel: BookingAcquisitionChannel;
  totalBookings: number;
  paidBookings: number;
  conversionRate: number;
  totalGmv: number;
  paidGmv: number;
};

type PartnerRow = {
  ownerId: string;
  partnerSlug: string;
  partnerName: string;
  totalBookings: number;
  paidBookings: number;
  conversionRate: number;
  totalGmv: number;
  paidGmv: number;
};

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdminOrStaffWithRedirect(request);
  const url = new URL(request.url);

  const fallbackRange = getDefaultDateRange();
  const rawFrom = url.searchParams.get("from");
  const rawTo = url.searchParams.get("to");
  const parsedFrom = parseDateInput(rawFrom, "start");
  const parsedTo = parseDateInput(rawTo, "end");

  let from = parsedFrom ?? fallbackRange.from;
  let to = parsedTo ?? fallbackRange.to;
  if (from > to) {
    [from, to] = [to, from];
  }

  const baseWhere = {
    deletedAt: null,
    createdAt: { gte: from, lte: to },
  };

  const [
    overall,
    overallPaid,
    paidFinancials,
    channelTotals,
    channelPaidTotals,
    partnerTotals,
    partnerPaidTotals,
  ] = await Promise.all([
    prisma.booking.aggregate({
      where: baseWhere,
      _count: { _all: true },
      _sum: { totalAmount: true },
    }),
    prisma.booking.aggregate({
      where: { ...baseWhere, paymentStatus: PaymentStatus.PAID },
      _count: { _all: true },
      _sum: { totalAmount: true },
    }),
    prisma.booking.aggregate({
      where: { ...baseWhere, paymentStatus: PaymentStatus.PAID },
      _sum: {
        referralDiscountAmount: true,
        referralCreditsUsed: true,
        fleetOwnerPayoutAmountNet: true,
        vatAmount: true,
        platformFleetOwnerCommissionAmount: true,
      },
    }),
    prisma.booking.groupBy({
      by: ["acquisitionChannel"],
      where: baseWhere,
      _count: { _all: true },
      _sum: { totalAmount: true },
    }),
    prisma.booking.groupBy({
      by: ["acquisitionChannel"],
      where: { ...baseWhere, paymentStatus: PaymentStatus.PAID },
      _count: { _all: true },
      _sum: { totalAmount: true },
    }),
    prisma.booking.groupBy({
      by: ["acquisitionPartnerOwnerId", "acquisitionPartnerSlug"],
      where: {
        ...baseWhere,
        acquisitionChannel: BookingAcquisitionChannel.PARTNER,
        acquisitionPartnerOwnerId: { not: null },
      },
      _count: { _all: true },
      _sum: { totalAmount: true },
    }),
    prisma.booking.groupBy({
      by: ["acquisitionPartnerOwnerId", "acquisitionPartnerSlug"],
      where: {
        ...baseWhere,
        paymentStatus: PaymentStatus.PAID,
        acquisitionChannel: BookingAcquisitionChannel.PARTNER,
        acquisitionPartnerOwnerId: { not: null },
      },
      _count: { _all: true },
      _sum: { totalAmount: true },
    }),
  ]);

  const paidChannelMap = new Map(
    channelPaidTotals.map((item) => [
      item.acquisitionChannel,
      {
        count: item._count._all,
        paidGmv: toNumber(item._sum.totalAmount),
      },
    ]),
  );

  const channelRows: ChannelRow[] = channelTotals
    .map((item) => {
      const paid = paidChannelMap.get(item.acquisitionChannel) ?? { count: 0, paidGmv: 0 };
      const totalBookings = item._count._all;
      const paidBookings = paid.count;
      return {
        channel: item.acquisitionChannel,
        totalBookings,
        paidBookings,
        conversionRate: asPercent(paidBookings, totalBookings),
        totalGmv: toNumber(item._sum.totalAmount),
        paidGmv: paid.paidGmv,
      };
    })
    .sort((a, b) => b.totalBookings - a.totalBookings);

  const paidPartnerMap = new Map(
    partnerPaidTotals.map((item) => [
      `${item.acquisitionPartnerOwnerId}::${item.acquisitionPartnerSlug ?? ""}`,
      {
        count: item._count._all,
        paidGmv: toNumber(item._sum.totalAmount),
      },
    ]),
  );

  const ownerIds = Array.from(
    new Set(
      partnerTotals
        .map((item) => item.acquisitionPartnerOwnerId)
        .filter((ownerId): ownerId is string => Boolean(ownerId)),
    ),
  );
  const owners = ownerIds.length
    ? await prisma.user.findMany({
        where: { id: { in: ownerIds } },
        select: { id: true, name: true, username: true },
      })
    : [];
  const ownerById = new Map(owners.map((owner) => [owner.id, owner]));

  const partnerRows: PartnerRow[] = partnerTotals
    .filter((item): item is typeof item & { acquisitionPartnerOwnerId: string } =>
      Boolean(item.acquisitionPartnerOwnerId),
    )
    .map((item) => {
      const key = `${item.acquisitionPartnerOwnerId}::${item.acquisitionPartnerSlug ?? ""}`;
      const paid = paidPartnerMap.get(key) ?? { count: 0, paidGmv: 0 };
      const totalBookings = item._count._all;
      const paidBookings = paid.count;
      const owner = ownerById.get(item.acquisitionPartnerOwnerId);
      const partnerSlug = item.acquisitionPartnerSlug ?? owner?.username ?? "unknown-partner";
      const partnerName =
        owner?.name?.trim() || owner?.username?.trim() || item.acquisitionPartnerSlug || "Unknown";

      return {
        ownerId: item.acquisitionPartnerOwnerId,
        partnerSlug,
        partnerName,
        totalBookings,
        paidBookings,
        conversionRate: asPercent(paidBookings, totalBookings),
        totalGmv: toNumber(item._sum.totalAmount),
        paidGmv: paid.paidGmv,
      };
    })
    .sort((a, b) => b.totalBookings - a.totalBookings);

  const totalBookings = overall._count._all;
  const paidBookings = overallPaid._count._all;
  const totalGmv = toNumber(overall._sum.totalAmount);
  const paidGmv = toNumber(overallPaid._sum.totalAmount);
  const totalReferralDiscount = toNumber(paidFinancials._sum.referralDiscountAmount);
  const totalReferralCreditsUsed = toNumber(paidFinancials._sum.referralCreditsUsed);
  const totalCustomerBenefit = totalReferralDiscount + totalReferralCreditsUsed;
  const totalFleetOwnerPayout = toNumber(paidFinancials._sum.fleetOwnerPayoutAmountNet);
  const totalVat = toNumber(paidFinancials._sum.vatAmount);
  const totalFleetOwnerCommission = toNumber(
    paidFinancials._sum.platformFleetOwnerCommissionAmount,
  );

  return data(
    {
      filters: {
        from: toInputDate(from),
        to: toInputDate(to),
      },
      summary: {
        totalBookings,
        paidBookings,
        conversionRate: asPercent(paidBookings, totalBookings),
        totalGmv,
        paidGmv,
        totalReferralDiscount,
        totalReferralCreditsUsed,
        totalCustomerBenefit,
        totalFleetOwnerPayout,
        totalVat,
        totalFleetOwnerCommission,
      },
      channelRows,
      partnerRows,
    },
    { headers: { "Cache-Control": "no-store, private, must-revalidate", Vary: "Cookie" } },
  );
}

export default function AdminReportsPage() {
  const { filters, summary, channelRows, partnerRows } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Acquisition Reports</h1>
        <p className="text-muted-foreground">
          Channel and partner performance for bookings created in the selected date range.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Date range</CardTitle>
        </CardHeader>
        <CardContent>
          <form method="get" className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">From</span>
              <input
                type="date"
                name="from"
                defaultValue={filters.from}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">To</span>
              <input
                type="date"
                name="to"
                defaultValue={filters.to}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              />
            </label>
            <button
              type="submit"
              className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              Apply
            </button>
            <Link
              to="/admin/reports"
              className="h-10 rounded-md border border-input px-4 text-sm inline-flex items-center"
            >
              Reset
            </Link>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Bookings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalBookings}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Paid bookings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.paidBookings}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Conversion</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPercent(summary.conversionRate)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">GMV (all)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.totalGmv)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">GMV (paid)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.paidGmv)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Customer benefit (paid)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.totalCustomerBenefit)}</div>
            <p className="text-xs text-muted-foreground">
              Discount {formatCurrency(summary.totalReferralDiscount)} + credits{" "}
              {formatCurrency(summary.totalReferralCreditsUsed)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Fleet payout base (paid)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(summary.totalFleetOwnerPayout)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">VAT (paid)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.totalVat)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Commission (paid)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(summary.totalFleetOwnerCommission)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>By acquisition channel</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 pr-4">Channel</th>
                  <th className="py-2 pr-4">Bookings</th>
                  <th className="py-2 pr-4">Paid</th>
                  <th className="py-2 pr-4">Conversion</th>
                  <th className="py-2 pr-4">GMV (all)</th>
                  <th className="py-2 pr-0">GMV (paid)</th>
                </tr>
              </thead>
              <tbody>
                {channelRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-sm text-muted-foreground">
                      No channels found.
                    </td>
                  </tr>
                ) : (
                  channelRows.map((row) => (
                    <tr key={row.channel} className="border-b last:border-b-0">
                      <td className="py-2 pr-4 font-medium">{row.channel}</td>
                      <td className="py-2 pr-4">{row.totalBookings}</td>
                      <td className="py-2 pr-4">{row.paidBookings}</td>
                      <td className="py-2 pr-4">{formatPercent(row.conversionRate)}</td>
                      <td className="py-2 pr-4">{formatCurrency(row.totalGmv)}</td>
                      <td className="py-2 pr-0">{formatCurrency(row.paidGmv)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>By partner owner</CardTitle>
        </CardHeader>
        <CardContent>
          {partnerRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No partner-attributed bookings found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-4">Partner</th>
                    <th className="py-2 pr-4">Slug</th>
                    <th className="py-2 pr-4">Bookings</th>
                    <th className="py-2 pr-4">Paid</th>
                    <th className="py-2 pr-4">Conversion</th>
                    <th className="py-2 pr-4">GMV (all)</th>
                    <th className="py-2 pr-0">GMV (paid)</th>
                  </tr>
                </thead>
                <tbody>
                  {partnerRows.map((row) => (
                    <tr
                      key={`${row.ownerId}-${row.partnerSlug}`}
                      className="border-b last:border-b-0"
                    >
                      <td className="py-2 pr-4 font-medium">{row.partnerName}</td>
                      <td className="py-2 pr-4">{row.partnerSlug}</td>
                      <td className="py-2 pr-4">{row.totalBookings}</td>
                      <td className="py-2 pr-4">{row.paidBookings}</td>
                      <td className="py-2 pr-4">{formatPercent(row.conversionRate)}</td>
                      <td className="py-2 pr-4">{formatCurrency(row.totalGmv)}</td>
                      <td className="py-2 pr-0">{formatCurrency(row.paidGmv)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
