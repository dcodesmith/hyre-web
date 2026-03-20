import {
  ChartBarIcon,
  CogIcon,
  CurrencyDollarIcon,
  GiftIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import { ReferralRewardStatus } from "@prisma/client";
import { type LoaderFunctionArgs, Link, useLoaderData } from "react-router";
import { Badge, BadgeProps } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { requireAdminOrStaffWithRedirect } from "~/modules/auth/auth.server";
import { prisma } from "~/modules/db/db.server";
import { getReferralConfig } from "~/services/referral.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdminOrStaffWithRedirect(request);

  // Get referral statistics
  const [
    totalAttributions,
    totalRewards,
    pendingRewards,
    releasedRewards,
    reversedRewards,
    totalDiscountAmount,
    recentAttributions,
    recentRewards,
    config,
  ] = await Promise.all([
    // Total referral attributions
    prisma.referralAttribution.count(),

    // Total rewards
    prisma.referralReward.count(),

    // Pending rewards count and amount
    prisma.referralReward.aggregate({
      where: { status: "PENDING" },
      _count: { id: true },
      _sum: { amount: true },
    }),

    // Released rewards count and amount
    prisma.referralReward.aggregate({
      where: { status: "RELEASED" },
      _count: { id: true },
      _sum: { amount: true },
    }),

    // Reversed rewards count and amount
    prisma.referralReward.aggregate({
      where: { status: "REVERSED" },
      _count: { id: true },
      _sum: { amount: true },
    }),

    // Total discount amount applied
    prisma.booking.aggregate({
      where: {
        referralDiscountAmount: { gt: 0 },
        referralStatus: { not: "NONE" },
      },
      _sum: { referralDiscountAmount: true },
    }),

    // Recent attributions (last 10)
    prisma.referralAttribution.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
        referee: { select: { name: true, email: true } },
        referrer: { select: { name: true, email: true } },
      },
    }),

    // Recent rewards (last 10)
    prisma.referralReward.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
        referrer: { select: { name: true, email: true } },
        referee: { select: { name: true, email: true } },
      },
    }),

    // Referral configuration
    getReferralConfig(),
  ]);

  // Calculate conversion rate
  const conversionRate =
    totalAttributions > 0
      ? Math.round(((releasedRewards._count.id || 0) / totalAttributions) * 100 * 10) / 10
      : 0;

  return {
    stats: {
      totalAttributions,
      totalRewards,
      pendingRewards: {
        count: pendingRewards._count.id || 0,
        amount: Number(pendingRewards._sum.amount || 0),
      },
      releasedRewards: {
        count: releasedRewards._count.id || 0,
        amount: Number(releasedRewards._sum.amount || 0),
      },
      reversedRewards: {
        count: reversedRewards._count.id || 0,
        amount: Number(reversedRewards._sum.amount || 0),
      },
      totalDiscountAmount: Number(totalDiscountAmount._sum.referralDiscountAmount || 0),
      conversionRate,
    },
    recentAttributions,
    recentRewards: recentRewards.map((r) => ({ ...r, amount: Number(r.amount) })),
    config,
  };
}

function getRewardStatusVariant(status: ReferralRewardStatus): BadgeProps["variant"] {
  switch (status) {
    case "RELEASED":
      return "default";
    case "PENDING":
      return "secondary";
    case "REVERSED":
      return "destructive";
    default:
      return "default";
  }
}

export default function AdminReferralsIndex() {
  const { stats, recentAttributions, recentRewards, config } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Referral Management</h1>
          <p className="text-muted-foreground">Monitor and manage the referral program</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/admin/referrals/config">
              <CogIcon className="h-4 w-4 mr-2" />
              Configure
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/admin/referrals/manual-attribution">Manual Attribution</Link>
          </Button>
          <Button asChild>
            <Link to="/admin/referrals/rewards">View All Rewards</Link>
          </Button>
        </div>
      </div>

      {/* Program Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GiftIcon className="h-5 w-5" />
            Program Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Badge variant={config.REFERRAL_ENABLED ? "default" : "secondary"}>
              {config.REFERRAL_ENABLED ? "ACTIVE" : "DISABLED"}
            </Badge>
            <div className="text-sm text-muted-foreground">
              Discount: ₦{config.REFERRAL_DISCOUNT_AMOUNT.toLocaleString()} • Min Booking: ₦
              {config.REFERRAL_MIN_BOOKING_AMOUNT.toLocaleString()} • Release:{" "}
              {config.REFERRAL_RELEASE_CONDITION}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Referrals</CardTitle>
            <UsersIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAttributions}</div>
            <p className="text-xs text-muted-foreground">Users referred to the platform</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rewards Paid</CardTitle>
            <CurrencyDollarIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₦{(stats.releasedRewards.amount || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.releasedRewards.count} rewards released
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Rewards</CardTitle>
            <ChartBarIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₦{(stats.pendingRewards.amount || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.pendingRewards.count} rewards pending
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <GiftIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.conversionRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Referrals that earned rewards</p>
          </CardContent>
        </Card>
      </div>

      {/* Additional Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Discounts Applied</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              ₦{(stats.totalDiscountAmount || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Total customer savings</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Reversed Rewards</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-orange-600">{stats.reversedRewards.count}</div>
            <p className="text-xs text-muted-foreground">
              ₦{(stats.reversedRewards.amount || 0).toLocaleString()} reversed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Program ROI</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-green-600">
              {stats.totalDiscountAmount > 0 && stats.releasedRewards.amount > 0
                ? Math.round(
                    (stats.totalDiscountAmount / stats.releasedRewards.amount) * 100 * 10,
                  ) / 10
                : 0}
              %
            </div>
            <p className="text-xs text-muted-foreground">Revenue per reward paid</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Recent Attributions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Recent Referrals</span>
              <Button asChild variant="outline" size="sm">
                <Link to="/admin/referrals/attributions">View All</Link>
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentAttributions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recent referrals</p>
              ) : (
                recentAttributions.map((attribution) => (
                  <div key={attribution.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        {attribution.referee.name || attribution.referee.email}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Referred by {attribution.referrer.name || attribution.referrer.email}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className="text-xs">
                        {attribution.source}
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        {new Date(attribution.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Rewards */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Recent Rewards</span>
              <Button asChild variant="outline" size="sm">
                <Link to="/admin/referrals/rewards">View All</Link>
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentRewards.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recent rewards</p>
              ) : (
                recentRewards.map((reward) => (
                  <div key={reward.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">₦{reward.amount.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">
                        To {reward.referrer.name || reward.referrer.email}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant={getRewardStatusVariant(reward.status)} className="text-xs">
                        {reward.status}
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        {new Date(reward.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Button asChild variant="outline" className="h-auto p-4">
          <Link to="/admin/referrals/attributions" className="flex flex-col items-center gap-2">
            <UsersIcon className="h-6 w-6" />
            <div className="text-center">
              <div className="font-medium">Manage Attributions</div>
              <div className="text-xs text-muted-foreground">
                View and audit referral attributions
              </div>
            </div>
          </Link>
        </Button>

        <Button asChild variant="outline" className="h-auto p-4">
          <Link to="/admin/referrals/rewards" className="flex flex-col items-center gap-2">
            <GiftIcon className="h-6 w-6" />
            <div className="text-center">
              <div className="font-medium">Manage Rewards</div>
              <div className="text-xs text-muted-foreground">
                Release, reverse, or audit rewards
              </div>
            </div>
          </Link>
        </Button>

        <Button asChild variant="outline" className="h-auto p-4">
          <Link to="/admin/referrals/config" className="flex flex-col items-center gap-2">
            <CogIcon className="h-6 w-6" />
            <div className="text-center">
              <div className="font-medium">Program Settings</div>
              <div className="text-xs text-muted-foreground">
                Configure discount amounts and rules
              </div>
            </div>
          </Link>
        </Button>
      </div>
    </div>
  );
}
