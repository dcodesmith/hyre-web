import { LoaderFunctionArgs } from "@remix-run/node";
import logger from "~/lib/logger.server";
import { requireUserWithRole } from "~/utils/server/permissions.server";
import {
  getUserReferralInfo,
  getUserBookingCredits,
  getReferralConfig,
} from "~/services/referral.server";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const user = await requireUserWithRole(request, "user");
    const [referralInfo, bookingCredits, config] = await Promise.all([
      getUserReferralInfo(user.id),
      getUserBookingCredits(user.id),
      getReferralConfig(),
    ]);

    if (!referralInfo) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    // Generate share link
    const baseUrl = new URL(request.url).origin;
    const shareLink = referralInfo.referralCode
      ? `${baseUrl}/auth?ref=${referralInfo.referralCode}`
      : null;

    return Response.json({
      referralCode: referralInfo.referralCode,
      shareLink,
      hasUsedDiscount: referralInfo.referralDiscountUsed,
      referredBy: referralInfo.referredByUserId,
      signupDate: referralInfo.referralSignupAt,
      stats: {
        ...referralInfo.referralStats,
        totalRewardsGranted: Number(referralInfo.referralStats?.totalRewardsGranted || 0),
        totalEarned: bookingCredits.totalEarned,
        totalUsed: bookingCredits.totalUsed,
        availableCredits: bookingCredits.availableCredits,
        maxCreditsPerBooking: config.REFERRAL_MAX_CREDITS_PER_BOOKING,
      },
      referrals: referralInfo.referrals,
      rewards: referralInfo.referralRewardsEarned.map((reward) => ({
        id: reward.id,
        amount: Number(reward.amount),
        status: reward.status,
        createdAt: reward.createdAt,
        processedAt: reward.processedAt,
        refereeName: reward.referee?.name || reward.referee?.email || "Unknown",
      })),
    });
  } catch (error) {
    logger.error("Failed to fetch referral information", { error });
    return Response.json({ error: "Failed to fetch referral information" }, { status: 500 });
  }
}
