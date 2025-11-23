import { PaymentStatus, ReferralAttributionSource } from "@prisma/client";
import { prisma } from "~/modules/db/db.server";
import crypto from "node:crypto";
import logger from "~/lib/logger.server";
import { getLagosTime } from "~/utils/timezone";

// Constants
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // Uppercase-only Base58 (33 chars)
const REFERRAL_CODE_BYTES = 8; // 8 bytes = ~1.16 quadrillion unique combinations (33^8)
const REFERRAL_CODE_MIN_LENGTH = 8;
const MAX_COLLISION_RETRIES = 3;

/**
 * Generate a random referral code
 */
function generateReferralCode(): string {
  const bytes = crypto.randomBytes(REFERRAL_CODE_BYTES);
  let result = "";

  for (const byte of bytes) {
    result += BASE58_ALPHABET[byte % BASE58_ALPHABET.length];
  }

  return result; // Already uppercase - no need for transformation
}

/**
 * Generate a unique referral code for a user with collision retry
 */
export async function createReferralCodeForUser(userId: string): Promise<string> {
  const maxAttempts = MAX_COLLISION_RETRIES;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = generateReferralCode();

    try {
      await prisma.user.update({
        where: { id: userId },
        data: { referralCode: code },
      });

      return code;
    } catch (error: unknown) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "P2002" &&
        attempt < maxAttempts - 1
      ) {
        continue;
      }
      throw error;
    }
  }

  throw new Error("Failed to generate unique referral code after multiple attempts");
}

export async function handleReferralAttribution(
  userId: string,
  referralCode: string,
  request: Request,
) {
  try {
    const ipAddress = request.headers.get("x-forwarded-for") || "unknown";
    const userAgent = request.headers.get("user-agent") || "unknown";

    await attributeReferral({
      refereeUserId: userId,
      referralCode,
      source: ReferralAttributionSource.LINK,
      ipAddress,
      userAgent,
    });

    logger.info("Referral attribution successful", { userId, referralCode });
  } catch (error) {
    logger.error("Referral attribution failed", { userId, referralCode, error });
  }
}

export async function validateReferralCode(code: string, userEmail: string) {
  if (!code || code.length < REFERRAL_CODE_MIN_LENGTH) {
    return null;
  }

  const normalizedCode = code.toUpperCase().trim();

  const referrer = await prisma.user.findUnique({
    where: { referralCode: normalizedCode },
    select: {
      id: true,
      name: true,
      email: true,
      referralCode: true,
    },
  });

  if (!referrer) {
    throw new Error("The referral code you entered is invalid.");
  }

  if (referrer.email === userEmail) {
    throw new Error("You cannot refer yourself.");
  }

  return referrer;
}

export async function attributeReferral({
  refereeUserId,
  referralCode,
  source,
  ipAddress,
  userAgent,
  sessionId,
}: {
  refereeUserId: string;
  referralCode: string;
  source: ReferralAttributionSource;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
}) {
  const referrer = await getReferrerByReferralCode(referralCode);

  if (!referrer) {
    throw new Error("Referrer not found");
  }

  const existingAttribution = await prisma.referralAttribution.findUnique({
    where: { refereeUserId },
  });

  if (existingAttribution) {
    throw new Error("User already has referral attribution");
  }

  return await prisma.$transaction(async (tx) => {
    const attribution = await tx.referralAttribution.create({
      data: {
        refereeUserId,
        referrerUserId: referrer.id,
        referralCode,
        source,
        ipAddress,
        userAgent,
        sessionId,
        securityFlags: {
          timestamp: new Date().toISOString(),
          source,
        },
      },
    });

    const updatedUser = await tx.user.update({
      where: { id: refereeUserId },
      data: {
        referredByUserId: referrer.id,
        referralAttributionSource: source,
        referralSignupAt: new Date(),
      },
    });

    await tx.userReferralStats.upsert({
      where: { userId: referrer.id },
      create: {
        userId: referrer.id,
        totalReferrals: 1,
        lastReferralAt: new Date(),
      },
      update: {
        totalReferrals: { increment: 1 },
        lastReferralAt: new Date(),
      },
    });

    return { attribution, updatedUser };
  });
}

export async function getReferrerByReferralCode(referralCode: string) {
  return await prisma.user.findUnique({
    where: { referralCode },
    select: { id: true, name: true, email: true, phoneNumber: true },
  });
}

export async function getReferralConfig() {
  const configs = await prisma.referralProgramConfig.findMany();

  const configMap = configs.reduce(
    (acc, config) => {
      acc[config.key] = config.value;
      return acc;
    },
    {} as Record<string, unknown>,
  );

  return {
    REFERRAL_ENABLED: configMap.REFERRAL_ENABLED ?? true,
    REFERRAL_DISCOUNT_AMOUNT: Number(configMap.REFERRAL_DISCOUNT_AMOUNT ?? 10000),
    REFERRAL_MIN_BOOKING_AMOUNT: Number(configMap.REFERRAL_MIN_BOOKING_AMOUNT ?? 20000),
    REFERRAL_ELIGIBLE_TYPES: configMap.REFERRAL_ELIGIBLE_TYPES ?? ["DAY", "NIGHT", "FULL_DAY"],
    REFERRAL_RELEASE_CONDITION: configMap.REFERRAL_RELEASE_CONDITION ?? "COMPLETED",
    REFERRAL_EXPIRY_DAYS: Number(configMap.REFERRAL_EXPIRY_DAYS ?? 30),
    REFERRAL_MAX_CREDITS_PER_BOOKING: Number(configMap.REFERRAL_MAX_CREDITS_PER_BOOKING ?? 30000),
  };
}

export async function checkReferralEligibility(
  userId: string,
  bookingAmount: number,
  bookingType: string,
) {
  const config = await getReferralConfig();

  if (!config.REFERRAL_ENABLED) {
    return { eligible: false, reason: "Referral program is disabled" };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      referredByUserId: true,
      referralDiscountUsed: true,
      referralSignupAt: true,
    },
  });

  if (!user?.referredByUserId) {
    return { eligible: false, reason: "User was not referred" };
  }

  if (user.referralDiscountUsed) {
    return { eligible: false, reason: "Referral discount already used" };
  }

  // Guard against reuse while a referral discount is already reserved
  // Block if there is any in-flight booking that already applied the referral
  const existingReserved = await prisma.booking.findFirst({
    where: {
      userId,
      referralStatus: { in: ["APPLIED", "REWARDED"] },
      status: { in: ["PENDING", "CONFIRMED", "ACTIVE"] },
    },
    select: { id: true },
  });
  if (existingReserved) {
    return { eligible: false, reason: "Referral discount already reserved or used" };
  }

  if (bookingAmount < config.REFERRAL_MIN_BOOKING_AMOUNT) {
    return {
      eligible: false,
      reason: `Booking amount must be at least ₦${config.REFERRAL_MIN_BOOKING_AMOUNT.toLocaleString()}`,
    };
  }

  if (
    !Array.isArray(config.REFERRAL_ELIGIBLE_TYPES) ||
    !config.REFERRAL_ELIGIBLE_TYPES.includes(bookingType)
  ) {
    return { eligible: false, reason: "Booking type is not eligible for referral discount" };
  }

  if (config.REFERRAL_EXPIRY_DAYS > 0 && user.referralSignupAt) {
    const expiryDate = new Date(user.referralSignupAt);
    expiryDate.setDate(expiryDate.getDate() + config.REFERRAL_EXPIRY_DAYS);

    // Use Lagos time for consistent timezone handling
    const now = getLagosTime();
    if (now > expiryDate) {
      return { eligible: false, reason: "Referral discount has expired" };
    }
  }

  return {
    eligible: true,
    discountAmount: Math.min(config.REFERRAL_DISCOUNT_AMOUNT, bookingAmount),
    referrerId: user.referredByUserId,
  };
}

export async function applyReferralDiscount(
  bookingId: string,
  userId: string,
  referrerId: string,
  discountAmount: number,
) {
  await prisma.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id: bookingId },
      data: {
        referralReferrerUserId: referrerId,
        referralDiscountAmount: discountAmount,
        referralStatus: "APPLIED",
      },
    });

    // Do not mark the user's one-time discount as used here.
    // In COMPLETED mode, the worker will mark referralDiscountUsed = true upon successful completion.

    const config = await getReferralConfig();
    await tx.referralReward.create({
      data: {
        referrerUserId: referrerId,
        refereeUserId: userId,
        bookingId,
        amount: discountAmount,
        status: "PENDING",
        releaseCondition: config.REFERRAL_RELEASE_CONDITION as "PAID" | "COMPLETED",
      },
    });

    await tx.userReferralStats.upsert({
      where: { userId: referrerId },
      create: {
        userId: referrerId,
        totalReferrals: 0,
        totalRewardsGranted: 0,
        totalRewardsPending: discountAmount,
      },
      update: { totalRewardsPending: { increment: discountAmount } },
    });
  });
}

export async function releaseReferralReward(bookingId: string) {
  const reward = await prisma.referralReward.findFirst({
    where: {
      bookingId,
      status: "PENDING",
    },
  });

  if (!reward) {
    return null;
  }

  await prisma.$transaction(async (tx) => {
    await tx.referralReward.update({
      where: { id: reward.id },
      data: {
        status: "RELEASED",
        processedAt: new Date(),
      },
    });

    await tx.booking.update({
      where: { id: bookingId },
      data: { referralStatus: "REWARDED" },
    });

    await tx.userReferralStats.upsert({
      where: { userId: reward.referrerUserId },
      create: {
        userId: reward.referrerUserId,
        totalRewardsGranted: reward.amount,
        totalRewardsPending: 0,
      },
      update: {
        totalRewardsGranted: { increment: reward.amount },
        totalRewardsPending: { decrement: reward.amount },
      },
    });
  });

  return reward;
}

export async function getUserReferralInfo(userId: string) {
  return await prisma.user.findUnique({
    where: { id: userId },
    select: {
      referralCode: true,
      referredByUserId: true,
      referralDiscountUsed: true,
      referralSignupAt: true,
      referralStats: true,
      referrals: {
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
        },
      },
      referralRewardsEarned: {
        select: {
          id: true,
          amount: true,
          status: true,
          createdAt: true,
          processedAt: true,
          referee: {
            select: { name: true, email: true },
          },
        },
      },
    },
  });
}

/**
 * Get user's available booking credits from earned rewards
 */
export async function getUserBookingCredits(userId: string) {
  const userStats = await prisma.userReferralStats.findUnique({
    where: { userId },
    select: {
      totalRewardsGranted: true,
    },
  });

  const usedCredits = await prisma.booking.aggregate({
    where: {
      paymentStatus: PaymentStatus.PAID,
      userId,
      referralCreditsUsed: { gt: 0 },
    },
    _sum: {
      referralCreditsUsed: true,
    },
  });

  // Get reserved credits from unpaid bookings (not cancelled)
  // Note: Will work after Prisma regeneration
  const reservedCredits = await prisma.booking.aggregate({
    where: {
      paymentStatus: PaymentStatus.UNPAID,
      status: { notIn: ["CANCELLED"] },
      userId,
      referralCreditsReserved: { gt: 0 },
    },
    _sum: {
      referralCreditsReserved: true,
    },
  });

  const totalEarned = userStats?.totalRewardsGranted?.toNumber() || 0;
  const totalUsed = usedCredits._sum.referralCreditsUsed?.toNumber() || 0;
  const totalReserved = reservedCredits._sum?.referralCreditsReserved?.toNumber() || 0;
  const availableCredits = Math.max(0, totalEarned - totalUsed - totalReserved);

  return {
    totalEarned,
    totalUsed,
    totalReserved,
    availableCredits,
  };
}

/**
 * Calculate maximum credit that can be applied to a booking
 */
export async function calculateMaxCreditForBooking(
  userId: string,
  bookingAmount: number,
): Promise<number> {
  const { availableCredits } = await getUserBookingCredits(userId);
  const config = await getReferralConfig();
  const maxCreditsPerBooking = config.REFERRAL_MAX_CREDITS_PER_BOOKING;

  return Math.min(availableCredits, bookingAmount, maxCreditsPerBooking);
}

/**
 * Reserve credits for a booking with atomic transaction
 * Prevents double-spending by validating available credits within transaction
 */
export async function reserveCreditsForBooking(
  bookingId: string,
  userId: string,
  creditsToReserve: number,
): Promise<{ success: boolean; actualReserved: number; error?: string }> {
  if (creditsToReserve <= 0) {
    return { success: true, actualReserved: 0 };
  }

  try {
    return await prisma.$transaction(
      async (tx) => {
        // Get current credit status within transaction
        const userStats = await tx.userReferralStats.findUnique({
          where: { userId },
          select: { totalRewardsGranted: true },
        });

        const usedCredits = await tx.booking.aggregate({
          where: {
            paymentStatus: PaymentStatus.PAID,
            userId,
            referralCreditsUsed: { gt: 0 },
          },
          _sum: { referralCreditsUsed: true },
        });

        const reservedCredits = await tx.booking.aggregate({
          where: {
            paymentStatus: PaymentStatus.UNPAID,
            status: { notIn: ["CANCELLED"] },
            userId,
            referralCreditsReserved: { gt: 0 },
            id: { not: bookingId }, // Exclude current booking
          },
          _sum: { referralCreditsReserved: true },
        });

        const totalEarned = userStats?.totalRewardsGranted?.toNumber() || 0;
        const totalUsed = usedCredits._sum.referralCreditsUsed?.toNumber() || 0;
        const totalReserved = reservedCredits._sum?.referralCreditsReserved?.toNumber() || 0;
        const availableCredits = Math.max(0, totalEarned - totalUsed - totalReserved);

        // Validate we have enough credits
        if (availableCredits < creditsToReserve) {
          return {
            success: false,
            actualReserved: 0,
            error: `Insufficient credits. Available: ${availableCredits}, Requested: ${creditsToReserve}`,
          };
        }

        // Update booking with reserved credits
        await tx.booking.update({
          where: { id: bookingId },
          data: { referralCreditsReserved: creditsToReserve },
        });

        return { success: true, actualReserved: creditsToReserve };
      },
      {
        isolationLevel: "Serializable", // Highest isolation to prevent race conditions
        maxWait: 5000, // Wait up to 5 seconds for transaction
        timeout: 10000, // Transaction timeout
      },
    );
  } catch (error) {
    logger.error("Failed to reserve credits", { bookingId, userId, creditsToReserve, error });
    return {
      success: false,
      actualReserved: 0,
      error: "Failed to reserve credits due to transaction error",
    };
  }
}

/**
 * Convert reserved credits to used credits when payment is confirmed
 */
export async function confirmCreditUsage(bookingId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      select: { referralCreditsReserved: true },
    });

    if (!booking?.referralCreditsReserved) {
      return;
    }

    await tx.booking.update({
      where: { id: bookingId },
      data: {
        referralCreditsUsed: booking.referralCreditsReserved,
        referralCreditsReserved: 0,
      },
    });
  });
}

/**
 * Release reserved credits when booking is cancelled
 */
export async function releaseReservedCredits(bookingId: string): Promise<void> {
  await prisma.booking.update({
    where: { id: bookingId },
    data: { referralCreditsReserved: 0 },
  });
}
