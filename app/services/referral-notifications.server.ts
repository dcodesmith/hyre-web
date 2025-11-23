import { sendEmail } from "~/modules/email/email.server";
import { sendMessage, Template } from "~/modules/messaging/messaging.server";
import logger from "~/lib/logger.server";
import {
  renderReferralAttributionEmail,
  renderReferralDiscountAppliedEmail,
  renderReferralRewardEarnedEmail,
} from "~/modules/email/templates/referral-emails";
import { prisma } from "~/modules/db/db.server";

interface NotificationUserData {
  id: string;
  name: string | null;
  email: string;
  phoneNumber?: string | null;
}

/**
 * Send referral attribution success notification (email + WhatsApp)
 */
export async function sendReferralAttributionNotification(
  refereeData: NotificationUserData & { referralCode: string },
  referrerData: NotificationUserData,
  discountAmount: number,
) {
  try {
    // Send email notification
    const emailHtml = await renderReferralAttributionEmail({
      name: refereeData.name || "User",
      referralCode: refereeData.referralCode,
      referrerName: referrerData.name || "Friend",
      discountAmount,
      phoneNumber: refereeData.phoneNumber || undefined,
    });

    await sendEmail({
      to: refereeData.email,
      subject: "Welcome! Your referral discount is ready",
      html: emailHtml,
    });

    logger.info("Referral attribution email sent", {
      refereeId: refereeData.id,
      referrerId: referrerData.id,
      discountAmount,
    });

    // Send WhatsApp notification if phone number exists
    if (refereeData.phoneNumber) {
      // Note: You would need to create a Twilio template for this
      // For now, we'll log the intent
      logger.info("WhatsApp referral attribution notification would be sent", {
        phone: refereeData.phoneNumber,
        refereeId: refereeData.id,
        discountAmount,
      });

      // Example of how it would work:
      // await sendMessage({
      //   to: refereeData.phoneNumber,
      //   templateKey: Template.ReferralAttribution, // Need to add this to enum
      //   variables: {
      //     name: refereeData.name,
      //     referrerName: referrerData.name,
      //     discountAmount: discountAmount.toString(),
      //   },
      // });
    }
  } catch (error) {
    logger.error("Failed to send referral attribution notification", {
      error: error instanceof Error ? error.message : String(error),
      refereeId: refereeData.id,
      referrerId: referrerData.id,
    });
  }
}

/**
 * Send referral discount applied notification (email + WhatsApp)
 */
export async function sendReferralDiscountAppliedNotification(
  bookingData: {
    id: string;
    bookingReference: string;
    carName: string;
    discountAmount: number;
    originalAmount: number;
    finalAmount: number;
  },
  customerData: NotificationUserData,
  referrerData: NotificationUserData,
) {
  try {
    // Send email notification
    const emailHtml = await renderReferralDiscountAppliedEmail({
      customerName: customerData.name || "User",
      bookingReference: bookingData.bookingReference,
      carName: bookingData.carName,
      discountAmount: bookingData.discountAmount,
      originalAmount: bookingData.originalAmount,
      finalAmount: bookingData.finalAmount,
      referrerName: referrerData.name || "Friend",
      phoneNumber: customerData.phoneNumber || undefined,
    });

    await sendEmail({
      to: customerData.email,
      subject: "Referral discount applied to your booking",
      html: emailHtml,
    });

    logger.info("Referral discount applied email sent", {
      bookingId: bookingData.id,
      customerId: customerData.id,
      discountAmount: bookingData.discountAmount,
    });

    // Send WhatsApp notification if phone number exists
    if (customerData.phoneNumber) {
      logger.info("WhatsApp referral discount applied notification would be sent", {
        phone: customerData.phoneNumber,
        bookingId: bookingData.id,
        discountAmount: bookingData.discountAmount,
      });
    }
  } catch (error) {
    logger.error("Failed to send referral discount applied notification", {
      error: error instanceof Error ? error.message : String(error),
      bookingId: bookingData.id,
      customerId: customerData.id,
    });
  }
}

/**
 * Send referral reward earned notification (email + WhatsApp)
 */
export async function sendReferralRewardEarnedNotification(
  rewardData: {
    id: string;
    amount: number;
    bookingReference: string;
  },
  referrerData: NotificationUserData,
  refereedUserData: NotificationUserData,
) {
  try {
    // Get referrer stats
    const referrerStats = await prisma.userReferralStats.findUnique({
      where: { userId: referrerData.id },
      select: {
        totalReferrals: true,
        totalRewardsGranted: true,
      },
    });

    // Send email notification
    const emailHtml = await renderReferralRewardEarnedEmail({
      referrerName: referrerData.name || "User",
      referredUserName: refereedUserData.name || "Friend",
      rewardAmount: rewardData.amount,
      bookingReference: rewardData.bookingReference,
      totalReferrals: referrerStats?.totalReferrals || 0,
      totalRewardsEarned: (referrerStats?.totalRewardsGranted?.toNumber() || 0) + rewardData.amount,
      phoneNumber: referrerData.phoneNumber || undefined,
    });

    await sendEmail({
      to: referrerData.email,
      subject: `You've earned a referral reward of ₦${rewardData.amount.toLocaleString()}!`,
      html: emailHtml,
    });

    logger.info("Referral reward earned email sent", {
      rewardId: rewardData.id,
      referrerId: referrerData.id,
      rewardAmount: rewardData.amount,
    });

    // Send WhatsApp notification if phone number exists
    if (referrerData.phoneNumber) {
      logger.info("WhatsApp referral reward earned notification would be sent", {
        phone: referrerData.phoneNumber,
        rewardId: rewardData.id,
        rewardAmount: rewardData.amount,
      });
    }
  } catch (error) {
    logger.error("Failed to send referral reward earned notification", {
      error: error instanceof Error ? error.message : String(error),
      rewardId: rewardData.id,
      referrerId: referrerData.id,
    });
  }
}

/**
 * Create referral WhatsApp templates documentation
 * This function documents the WhatsApp templates that need to be created in Twilio
 */
export function getReferralWhatsAppTemplatesInfo() {
  return {
    templates: [
      {
        name: "referral_attribution",
        description: "Sent when a new user signs up with a referral code",
        variables: ["name", "referrerName", "discountAmount"],
        example:
          "Welcome {{name}}! Thanks to {{referrerName}}, you have a ₦{{discountAmount}} discount on your first booking!",
      },
      {
        name: "referral_discount_applied",
        description: "Sent when referral discount is applied to a booking",
        variables: ["name", "carName", "discountAmount", "referrerName"],
        example:
          "Great news {{name}}! Your ₦{{discountAmount}} referral discount has been applied to your {{carName}} booking. Thanks to {{referrerName}}!",
      },
      {
        name: "referral_reward_earned",
        description: "Sent when referrer earns a reward",
        variables: ["name", "referredUserName", "rewardAmount"],
        example:
          "Congratulations {{name}}! {{referredUserName}} just completed their first booking and you've earned ₦{{rewardAmount}}!",
      },
    ],
    instructions: [
      "1. Log into your Twilio Console",
      "2. Go to Messaging → Content Templates",
      "3. Create new WhatsApp templates for each of the above",
      "4. Get the Content SID for each template",
      "5. Add the Content SIDs to the contentSidMap in messaging.server.ts",
      "6. Update the Template enum to include referral templates",
    ],
  };
}
