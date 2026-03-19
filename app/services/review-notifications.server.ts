import { format } from "date-fns";
import { sendEmail } from "~/modules/email/email.server";
import logger from "~/lib/logger.server";
import {
  renderReviewReceivedEmailForOwner,
  renderReviewReceivedEmailForChauffeur,
} from "~/modules/email/templates/review-emails";
import { formatRating } from "~/utils/review-formatting";

export interface ReviewNotificationPayload {
  readonly owner: {
    readonly id: string;
    readonly name: string | null;
    readonly email: string;
  };
  readonly chauffeur: {
    readonly id: string;
    readonly name: string | null;
    readonly email: string;
  };
  readonly review: {
    readonly bookingReference: string;
    readonly carName: string;
    readonly customerName: string;
    readonly overallRating: number;
    readonly carRating: number;
    readonly chauffeurRating: number;
    readonly serviceRating: number;
    readonly comment: string | null;
    readonly reviewDate: Date;
  };
}

/**
 * Send review received notification to car owner
 */
async function sendReviewReceivedNotificationToOwner(
  ownerName: string,
  ownerEmail: string,
  ownerId: string,
  reviewData: ReviewNotificationPayload["review"],
): Promise<void> {
  try {
    const emailHtml = await renderReviewReceivedEmailForOwner(ownerName, {
      customerName: reviewData.customerName,
      bookingReference: reviewData.bookingReference,
      carName: reviewData.carName,
      overallRating: reviewData.overallRating,
      carRating: reviewData.carRating,
      chauffeurRating: reviewData.chauffeurRating,
      serviceRating: reviewData.serviceRating,
      comment: reviewData.comment,
      reviewDate: format(reviewData.reviewDate, "MMMM dd, yyyy 'at' h:mm a"),
    });

    await sendEmail({
      to: ownerEmail,
      subject: `New ${formatRating(reviewData.overallRating)}-star review received for ${reviewData.carName}`,
      html: emailHtml,
    });

    logger.info("Review received email sent to owner", {
      ownerId,
      bookingReference: reviewData.bookingReference,
      overallRating: reviewData.overallRating,
    });
  } catch (error) {
    logger.error("Failed to send review received email to owner", {
      error: error instanceof Error ? error.message : String(error),
      ownerId,
      bookingReference: reviewData.bookingReference,
    });
    // Don't throw - email failure shouldn't fail review creation
  }
}

/**
 * Send review received notification to chauffeur
 */
async function sendReviewReceivedNotificationToChauffeur(
  chauffeurName: string,
  chauffeurEmail: string,
  chauffeurId: string,
  reviewData: ReviewNotificationPayload["review"],
): Promise<void> {
  try {
    const emailHtml = await renderReviewReceivedEmailForChauffeur(chauffeurName, {
      customerName: reviewData.customerName,
      bookingReference: reviewData.bookingReference,
      carName: reviewData.carName,
      overallRating: reviewData.overallRating,
      carRating: reviewData.carRating,
      chauffeurRating: reviewData.chauffeurRating,
      serviceRating: reviewData.serviceRating,
      comment: reviewData.comment,
      reviewDate: format(reviewData.reviewDate, "MMMM dd, yyyy 'at' h:mm a"),
    });

    await sendEmail({
      to: chauffeurEmail,
      subject: `New ${formatRating(reviewData.chauffeurRating)}-star review received for your service`,
      html: emailHtml,
    });

    logger.info("Review received email sent to chauffeur", {
      chauffeurId,
      bookingReference: reviewData.bookingReference,
      chauffeurRating: reviewData.chauffeurRating,
    });
  } catch (error) {
    logger.error("Failed to send review received email to chauffeur", {
      error: error instanceof Error ? error.message : String(error),
      chauffeurId,
      bookingReference: reviewData.bookingReference,
    });
    // Don't throw - email failure shouldn't fail review creation
  }
}

/**
 * Send review received notifications to both owner and chauffeur
 */
export async function sendReviewReceivedNotifications(
  payload: ReviewNotificationPayload,
): Promise<void> {
  const ownerName = payload.owner.name || "Fleet Owner";
  const chauffeurName = payload.chauffeur.name || "Chauffeur";

  // Send notifications in parallel - don't wait for both to complete
  await Promise.allSettled([
    sendReviewReceivedNotificationToOwner(
      ownerName,
      payload.owner.email,
      payload.owner.id,
      payload.review,
    ),
    sendReviewReceivedNotificationToChauffeur(
      chauffeurName,
      payload.chauffeur.email,
      payload.chauffeur.id,
      payload.review,
    ),
  ]);
}
