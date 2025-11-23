import { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { requireUserWithRole } from "~/utils/server/permissions.server";
import {
  getUserReferralInfo,
  getReferralConfig,
  getUserBookingCredits,
} from "~/services/referral.server";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge, BadgeProps } from "~/components/ui/badge";
import { ClipboardIcon, ShareIcon, GiftIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import { useToast } from "~/hooks/use-toast";
import { formatCurrency } from "~/lib/utils";
import { ReferralRewardStatus } from "@prisma/client";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUserWithRole(request, "user");
  const referralInfo = await getUserReferralInfo(user.id);

  if (!referralInfo) {
    throw new Response("User not found", { status: 404 });
  }

  // Check if referral program is enabled
  // const { getReferralConfig } = await import("~/services/referral.server");
  const config = await getReferralConfig();

  // Get booking credits information
  const bookingCredits = await getUserBookingCredits(user.id);

  // Generate share link
  const baseUrl = new URL(request.url).origin;
  const shareLink = referralInfo.referralCode
    ? `${baseUrl}/auth?ref=${referralInfo.referralCode}`
    : null;

  return {
    referralCode: referralInfo.referralCode,
    shareLink,
    hasUsedDiscount: referralInfo.referralDiscountUsed,
    referredBy: referralInfo.referredByUserId,
    signupDate: referralInfo.referralSignupAt,
    stats: {
      ...referralInfo.referralStats,
      totalRewardsGranted: referralInfo.referralStats?.totalRewardsGranted?.toNumber() ?? 0,
      totalRewardsPending: referralInfo.referralStats?.totalRewardsPending?.toNumber() ?? 0,
    },
    bookingCredits: {
      totalEarned: bookingCredits.totalEarned,
      totalUsed: bookingCredits.totalUsed,
      availableCredits: bookingCredits.availableCredits,
    },
    referrals: referralInfo.referrals.map((ref) => ({
      id: ref.id,
      name: ref.name || ref.email,
      email: ref.email,
      joinDate: ref.createdAt,
    })),
    rewards: referralInfo.referralRewardsEarned.map((reward) => ({
      id: reward.id,
      amount: Number(reward.amount),
      status: reward.status,
      createdAt: reward.createdAt,
      processedAt: reward.processedAt,
      refereeName: reward.referee?.name || reward.referee?.email || "Unknown",
    })),
    programEnabled: config.REFERRAL_ENABLED,
    discountAmount: config.REFERRAL_DISCOUNT_AMOUNT,
  };
}

function getRewardStatusVariant(status: ReferralRewardStatus): BadgeProps["variant"] {
  switch (status) {
    case ReferralRewardStatus.RELEASED:
      return "default";
    case ReferralRewardStatus.PENDING:
      return "secondary";
    case ReferralRewardStatus.REVERSED:
      return "destructive";
    default:
      return "default";
  }
}

export default function ReferralsPage() {
  const {
    referralCode,
    shareLink,
    // hasUsedDiscount,
    stats,
    bookingCredits,
    referrals,
    rewards,
    programEnabled,
    discountAmount,
  } = useLoaderData<typeof loader>();
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const statsData = [
    {
      label: "Total Referrals",
      value: stats?.totalReferrals || 0,
      iconColor: "text-blue-500",
    },
    {
      label: "Rewards Earned",
      value: formatCurrency(stats?.totalRewardsGranted || 0),
      iconColor: "text-green-500",
    },
    {
      label: "Pending Rewards",
      value: formatCurrency(stats?.totalRewardsPending || 0),
      iconColor: "text-orange-500",
    },
    {
      label: "Used Credits",
      value: formatCurrency(bookingCredits.totalUsed),
      iconColor: "text-red-500",
    },
    {
      label: "Available Credits",
      value: formatCurrency(bookingCredits.availableCredits),
      iconColor: "text-purple-500",
    },
  ];

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Copied!",
        description: "Referral link copied to clipboard",
      });
    } catch (err) {
      console.error("Failed to copy to clipboard", err);
      toast({
        title: "Failed to copy",
        description: "Please copy the link manually",
        variant: "destructive",
      });
    }
  };

  const shareReferralLink = async () => {
    if (navigator.share && shareLink) {
      try {
        await navigator.share({
          title: "Join HireApp with my referral code",
          text: "Get a discount on your first booking!",
          url: shareLink,
        });
      } catch (err) {
        console.error("Failed to share referral link", err);
        // Fallback to copy
        copyToClipboard(shareLink);
      }
    } else if (shareLink) {
      copyToClipboard(shareLink);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Referral Program</h1>
        <p className="text-muted-foreground">
          Invite friends and earn rewards when they book their first trip!
        </p>
      </div>

      {/* Program Status Alert */}
      {!programEnabled && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center gap-2 text-yellow-800">
            <span className="font-medium">⚠️ Referral Program Temporarily Disabled</span>
          </div>
          <p className="text-sm text-yellow-700 mt-1">
            The referral program is currently disabled. New referrals cannot be processed at this
            time.
          </p>
        </div>
      )}

      {/* Referral Code Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GiftIcon className="h-5 w-5" />
            Your Referral Code
          </CardTitle>
        </CardHeader>
        <CardContent>
          {referralCode ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                <code className="text-lg font-mono font-bold">{referralCode}</code>
                <Button variant="outline" size="sm" onClick={() => copyToClipboard(referralCode)}>
                  <ClipboardIcon className="h-4 w-4 mr-2" />
                  {copied ? "Copied!" : "Copy"}
                </Button>
              </div>

              {shareLink && (
                <div className="space-y-2">
                  <label htmlFor="share-link" className="text-sm font-medium">
                    Share Link:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      id="share-link"
                      value={shareLink}
                      readOnly
                      className="flex-1 px-3 py-2 text-sm border rounded-md bg-background"
                    />
                    <Button variant="outline" size="sm" onClick={() => copyToClipboard(shareLink)}>
                      <ClipboardIcon className="h-4 w-4" />
                    </Button>
                    <Button size="sm" onClick={shareReferralLink}>
                      <ShareIcon className="h-4 w-4 md:mr-2" />
                      <span className="hidden md:inline">Share</span>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground">
              Your referral code is being generated. Please refresh the page.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        {statsData.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex flex-col items-center gap-2">
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-xl font-bold">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Rewards */}
      {rewards.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Recent Rewards</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {rewards.slice(0, 5).map((reward) => (
                <div
                  key={reward.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">₦{reward.amount.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">From {reward.refereeName}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant={getRewardStatusVariant(reward.status)}>
                      {reward.status.toLowerCase()}
                    </Badge>
                    <p className="text-sm text-muted-foreground">
                      {new Date(reward.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Your Referrals */}
      {referrals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Your Referrals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {referrals.map((referral) => (
                <div
                  key={referral.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">{referral.name}</p>
                    <p className="text-sm text-muted-foreground">{referral.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">
                      Joined {new Date(referral.joinDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* How it works */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>How it works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto mb-2">
                1
              </div>
              <h3 className="font-medium mb-1">Share your code</h3>
              <p className="text-sm text-muted-foreground">
                Send your referral code or link to friends
              </p>
            </div>
            <div className="text-center">
              <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto mb-2">
                2
              </div>
              <h3 className="font-medium mb-1">They sign up</h3>
              <p className="text-sm text-muted-foreground">
                Friends create an account using your code
              </p>
            </div>
            <div className="text-center">
              <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto mb-2">
                3
              </div>
              <h3 className="font-medium mb-1">Both get rewards</h3>
              <p className="text-sm text-muted-foreground">
                They get ₦{discountAmount.toLocaleString()} discount, you earn ₦
                {discountAmount.toLocaleString()} reward
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
