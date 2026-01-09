import type { PaymentAttemptStatus, Prisma } from "@prisma/client";
import { type ActionFunctionArgs } from "@remix-run/node";
import logger from "~/lib/logger.server";
import {
  formatCurrency,
  getCustomerDetails,
  normaliseBookingDetails,
  normaliseExtensionDetails,
} from "~/lib/utils";
import { prisma } from "~/modules/db/db.server";
import { sendEmail } from "~/modules/email/email.server";
import {
  bookingExtensionConfirmationEmail,
  renderBookingConfirmationEmail,
  renderFleetOwnerBookingNotificationEmail,
} from "~/modules/email/templates/booking-notification";
import { renderPayoutNotificationEmail } from "~/modules/email/templates/payout-notification";
import { Template, sendMessage } from "~/modules/messaging/messaging.server";
import { emailQueue } from "~/queues/email-throttle.server";
import {
  activateBooking,
  cancelBooking,
  findBookingByPaymentIntent,
} from "~/services/bookings.server";
import { activateExtension, findExtensionByPaymentIntent } from "~/services/extensions.server";
import { verifyPaymentWebhook, verifyTransaction } from "~/services/payment.server";
import {
  type FlutterwaveChargeCompletedPayload,
  type FlutterwaveRefundPayload,
  type FlutterwaveTransferCompletedPayload,
  isChargeCompletedPayload,
  isRefundPayload,
  isTransferCompletedPayload,
} from "~/types/payment";

async function createOrUpdatePaymentRecord(payload: FlutterwaveChargeCompletedPayload) {
  const {
    data: {
      tx_ref: paymentIntent,
      status,
      id: transactionId,
      amount = 0,
      currency = "NGN",
      payment_type: paymentMethod = "",
      flw_ref: flutterwaveReference = "",
    },
    meta_data,
  } = payload;
  const transactionType = meta_data.transactionType ?? "";

  const paymentStatus =
    status === "successful"
      ? ("SUCCESSFUL" as PaymentAttemptStatus)
      : ("FAILED" as PaymentAttemptStatus);

  try {
    // First find the related booking or extension to get its ID
    let bookingId: string | undefined;
    let extensionId: string | undefined;

    if (transactionType === "booking_creation") {
      const booking = await findBookingByPaymentIntent(paymentIntent);
      bookingId = booking?.id;
    } else if (transactionType === "booking_extension") {
      const extension = await findExtensionByPaymentIntent(paymentIntent);
      extensionId = extension?.id;
    }

    // Create or update payment record
    const payment = await prisma.payment.upsert({
      where: { txRef: paymentIntent },
      update: {
        status: paymentStatus,
        amountCharged: amount,
        currency,
        flutterwaveTransactionId: String(transactionId),
        paymentMethod,
        confirmedAt: new Date(),
        lastVerifiedAt: new Date(),
        webhookPayload: payload as unknown as Prisma.JsonObject,
      },
      create: {
        txRef: paymentIntent,
        status: paymentStatus,
        amountExpected: amount,
        amountCharged: amount,
        currency,
        flutterwaveTransactionId: String(transactionId),
        flutterwaveReference,
        paymentMethod,
        confirmedAt: new Date(),
        lastVerifiedAt: new Date(),
        webhookPayload: payload as unknown as Prisma.JsonObject,
        ...(bookingId && { bookingId }),
        ...(extensionId && { extensionId }),
      },
    });

    logger.info(`[Unified Webhook] Payment record updated/created: ${payment.id}`);
    return payment;
  } catch (error) {
    logger.error(`[Unified Webhook] Error updating payment record: ${error}`);
    return null;
  }
}

async function handleFailedPayment(paymentIntent: string, transactionType: string) {
  if (transactionType === "booking_creation") {
    const booking = await findBookingByPaymentIntent(paymentIntent);
    if (booking && booking.status === "PENDING") {
      await cancelBooking(booking.id, "Payment not successful");
      logger.info("Booking cancelled via cancelBooking()", {
        paymentIntent,
        bookingId: booking.id,
      });
    } else {
      await prisma.booking.updateMany({
        where: { paymentIntent, status: "PENDING" },
        data: { status: "CANCELLED" },
      });
      logger.info("Booking cancelled (fallback)", { paymentIntent });
    }
  } else if (transactionType === "booking_extension") {
    await prisma.extension.updateMany({
      where: { paymentIntent, status: "PENDING" },
      data: { status: "CANCELLED" },
    });
    logger.info("Extension cancelled", { paymentIntent });
  }
}

async function handleChargeCompleted(payload: FlutterwaveChargeCompletedPayload) {
  const {
    data: { status, tx_ref: paymentIntent, id: transactionId, amount, currency },
    meta_data,
  } = payload;

  const transactionType = meta_data.transactionType ?? "";

  const webhookData = {
    type: transactionType,
    status,
    paymentIntent,
    transactionId,
  };
  logger.info("Webhook details", webhookData);

  const currentStatus = String(status);
  const currentPaymentIntent = String(paymentIntent);
  const currentTransactionId = String(transactionId);

  await createOrUpdatePaymentRecord(payload);

  if (currentStatus !== "successful") {
    logger.warn("[Unified Webhook] Payment not successful", {
      transactionType,
      paymentIntent: currentPaymentIntent,
      status: currentStatus,
    });

    await handleFailedPayment(currentPaymentIntent, transactionType);
    return Response.json(
      { message: "Payment not successful, transaction cancelled." },
      { status: 400 },
    );
  }

  logger.info(
    `[Unified Webhook] Payment IS successful for ${transactionType} - PaymentIntent: ${currentPaymentIntent}`,
  );

  logger.info(
    `[Unified Webhook] Verifying transaction ${currentTransactionId} with Flutterwave API.`,
  );

  const expectedAmount = Number(meta_data?.amount ?? amount ?? 0);
  const expectedCurrency = String(meta_data?.currency ?? currency ?? "NGN");

  const verificationResult = await verifyTransaction(currentTransactionId, {
    amount: expectedAmount,
    currency: expectedCurrency,
    tx_ref: currentPaymentIntent,
  });

  if (!verificationResult.verified) {
    logger.error("[Unified Webhook] Transaction verification failed", {
      transactionType,
      transactionId: currentTransactionId,
      reason: verificationResult.mismatch ?? "unknown",
    });

    return Response.json({ error: "Transaction verification failed" }, { status: 400 });
  }

  logger.info(
    `[Unified Webhook] Transaction ${currentTransactionId} successfully verified with Flutterwave API.`,
  );

  try {
    if (transactionType === "booking_creation") {
      logger.info(`[Unified Webhook] Processing booking_creation for ${currentPaymentIntent}`);

      const pendingBooking = await findBookingByPaymentIntent(currentPaymentIntent);

      if (!pendingBooking) {
        logger.error(`[Unified Webhook] Pending booking not found for ${currentPaymentIntent}`);
        return Response.json({ error: "Booking not found" }, { status: 404 });
      }

      logger.info(`[Unified Webhook] Found pending booking ${pendingBooking.id}`);

      const booking = await activateBooking(pendingBooking.id, currentTransactionId);

      logger.info(`[Unified Webhook] Activated booking ${booking.id}`);

      const bookingDetails = normaliseBookingDetails(booking);

      if (bookingDetails.customerPhoneNumber) {
        await emailQueue.add(async () => {
          try {
            await sendMessage({
              variables: {
                "1": bookingDetails.customerName,
                "2": bookingDetails.carName,
                "3": bookingDetails.startDate,
                "4": bookingDetails.endDate,
                "5": bookingDetails.pickupLocation,
                "6": bookingDetails.returnLocation,
                "7": bookingDetails.totalAmount,
              },
              to: bookingDetails.customerPhoneNumber,
              templateKey: Template.BookingConfirmation,
            });
            logger.info("Customer WhatsApp message sent successfully");
          } catch (error) {
            logger.error("Customer WhatsApp message failed", {
              bookingId: bookingDetails.id,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        });
      }

      const ownerPhoneNumber = booking.car.owner.phoneNumber;

      if (ownerPhoneNumber) {
        await emailQueue.add(async () => {
          try {
            await sendMessage({
              variables: {
                "1": bookingDetails.ownerName,
                "2": bookingDetails.carName,
                "3": bookingDetails.customerName,
                "4": bookingDetails.startDate,
                "5": bookingDetails.endDate,
                "6": bookingDetails.pickupLocation,
                "7": bookingDetails.returnLocation,
                "8": bookingDetails.totalAmount,
                "9": bookingDetails.id,
              },
              to: ownerPhoneNumber,
              templateKey: Template.FleetOwnerBookingNotification,
            });
            logger.info("Fleet owner WhatsApp message sent successfully");
          } catch (error) {
            logger.error("Fleet owner WhatsApp message failed", {
              bookingId: booking.id,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        });
      }

      const { email } = getCustomerDetails(booking);

      // Send customer email as separate queue task
      await emailQueue.add(async () => {
        logger.info(`[Unified Webhook] Sending customer email to ${email}`);
        try {
          await sendEmail({
            to: email,
            subject: "Booking Confirmed",
            html: await renderBookingConfirmationEmail(bookingDetails),
          });
          logger.info("Customer email sent successfully");
        } catch (error) {
          logger.error(
            `Customer email failed,
            ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      });

      // Send fleet owner email as separate queue task
      await emailQueue.add(async () => {
        logger.info(`[Unified Webhook] Sending fleet owner email to ${booking.car.owner.email}`);
        try {
          await sendEmail({
            to: booking.car.owner.email,
            subject: "New Booking Alert",
            html: await renderFleetOwnerBookingNotificationEmail(bookingDetails),
          });
          logger.info("Fleet owner email sent successfully");
        } catch (error) {
          logger.error("Fleet owner email failed", {
            bookingId: booking.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });
    } else if (transactionType === "booking_extension") {
      logger.info(`[Unified Webhook] Processing booking extension for ${currentPaymentIntent}`);

      const pendingExtension = await findExtensionByPaymentIntent(currentPaymentIntent);

      if (!pendingExtension) {
        logger.error("Pending extension not found", { paymentIntent: currentPaymentIntent });
        return Response.json({ error: "Extension not found" }, { status: 404 });
      }

      logger.info("Found pending extension", {
        extensionId: pendingExtension.id,
        bookingId: pendingExtension.bookingLeg.booking.id,
      });

      const activatedExtension = await activateExtension(
        pendingExtension.id,
        String(currentTransactionId),
      );
      logger.info("Extension activated", { id: pendingExtension.id });

      const { booking } = activatedExtension.bookingLeg;
      const { email } = getCustomerDetails(booking);
      const extensionDetails = normaliseExtensionDetails(activatedExtension);
      const html = await bookingExtensionConfirmationEmail(extensionDetails);

      logger.info(`[Unified Webhook] Sending extension confirmation email to ${email}`);

      await emailQueue.add(async () => {
        if (extensionDetails.customerPhoneNumber) {
          await sendMessage({
            variables: {
              "1": extensionDetails.customerName,
              "2": extensionDetails.carName,
              "3": extensionDetails.legDate,
              "4": extensionDetails.extensionHours,
              "5": extensionDetails.from,
              "6": extensionDetails.to,
            },
            to: extensionDetails.customerPhoneNumber,
            templateKey: Template.BookingExtensionConfirmation,
          });
        }
        await sendEmail({ to: email, subject: "Booking Extension Confirmed", html });
      });

      logger.info(`[Unified Webhook] Extension confirmation email queued for ${email}`);

      logger.info(
        `[Unified Webhook] Booking extension for ${currentPaymentIntent} processed successfully.`,
      );
    } else {
      logger.warn("Unknown transaction type", {
        transactionType,
        paymentIntent: currentPaymentIntent,
      });
      return Response.json({ error: "Unknown transaction type" }, { status: 400 });
    }

    return Response.json({ message: "Webhook processed successfully" }, { status: 200 });
  } catch (error: unknown) {
    const e = error as Error;
    logger.error("Error processing webhook", {
      transactionType,
      paymentIntent: currentPaymentIntent,
      error: e.message,
      stack: e.stack,
    });
    return Response.json({ error: "Server error processing webhook" }, { status: 500 });
  }
}

/**
 * Reverses a referral reward when a refund is processed.
 */
async function reverseReferralReward(bookingId: string): Promise<void> {
  const reward = await prisma.referralReward.findFirst({
    where: { bookingId },
  });

  if (!reward) {
    return;
  }

  // Idempotency check - already reversed
  if (reward.status === "REVERSED") {
    logger.info("[Unified Webhook] Reward already reversed, skipping", {
      rewardId: reward.id,
      bookingId,
    });
    return;
  }

  if (reward.status === "RELEASED") {
    await prisma.$transaction([
      prisma.referralReward.update({
        where: { id: reward.id },
        data: { status: "REVERSED", reason: "Refund completed" },
      }),
      prisma.userReferralStats.update({
        where: { userId: reward.referrerUserId },
        data: { totalRewardsGranted: { decrement: reward.amount } },
      }),
      prisma.user.update({
        where: { id: reward.refereeUserId },
        data: { referralDiscountUsed: false },
      }),
      prisma.booking.update({
        where: { id: bookingId },
        data: { referralStatus: "REVERSED" },
      }),
    ]);
    logger.info("[Unified Webhook] Referral reversal completed for RELEASED reward", {
      rewardId: reward.id,
      bookingId,
      refereeUserId: reward.refereeUserId,
      referrerUserId: reward.referrerUserId,
      amount: reward.amount,
    });
    return;
  }

  if (reward.status === "PENDING") {
    await prisma.$transaction([
      prisma.referralReward.update({
        where: { id: reward.id },
        data: { status: "REVERSED", reason: "Refund completed" },
      }),
      prisma.user.update({
        where: { id: reward.refereeUserId },
        data: { referralDiscountUsed: false },
      }),
      prisma.userReferralStats.update({
        where: { userId: reward.referrerUserId },
        data: { totalRewardsPending: { decrement: reward.amount } },
      }),
      prisma.booking.update({
        where: { id: bookingId },
        data: { referralStatus: "REVERSED" },
      }),
    ]);
    logger.info("[Unified Webhook] Referral reversal completed for PENDING reward", {
      rewardId: reward.id,
      bookingId,
    });
    return;
  }

  logger.warn("[Unified Webhook] Reward status not eligible for reversal", {
    rewardId: reward.id,
    status: reward.status,
    bookingId,
  });
}

async function handleRefundCompleted(payload: FlutterwaveRefundPayload) {
  const { status: rawStatus, FlwRef: flutterwaveReference, id: refundId, AmountRefunded } = payload;

  // Defensively coerce status to string to handle null/undefined/unexpected types
  const status = String(rawStatus ?? "");

  logger.info("[Unified Webhook] Refund webhook received", {
    refundId,
    flutterwaveReference,
    status,
    amountRefunded: AmountRefunded,
  });

  // Accept all completed statuses (completed, completed-bank-transfer, completed-momo, etc.)
  const isCompleted = status.startsWith("completed");
  const isFailed = status === "failed";

  // Return 400 only for failed refunds
  if (isFailed) {
    logger.error(
      `[Unified Webhook] Refund failed for transaction reference: ${flutterwaveReference ?? "unknown"}.`,
    );
    return Response.json({ message: "Refund failed." }, { status: 400 });
  }

  // For non-failed but uncompleted statuses (e.g., "processing", "pending-momo", etc.),
  // return 200 OK with a benign message instead of 400
  if (!isCompleted) {
    logger.info(
      `[Unified Webhook] Refund event received with intermediate/unhandled status: ${status}. Acknowledging but not processing.`,
      {
        refundId,
        flutterwaveReference: flutterwaveReference ?? "unknown",
        status,
      },
    );
    return Response.json(
      {
        message: `Refund status '${status}' acknowledged. Processing will continue when status changes to completed.`,
      },
      { status: 200 },
    );
  }

  if (!flutterwaveReference) {
    logger.error(
      "[Unified Webhook] Flutterwave transaction reference (FlwRef) not found in refund payload.",
    );
    return Response.json({ error: "Transaction reference missing" }, { status: 400 });
  }

  try {
    logger.info("[Unified Webhook] Looking up payment record", {
      flutterwaveReference,
      refundId,
    });

    const payment = await prisma.payment.findUnique({
      where: { flutterwaveReference: String(flutterwaveReference) },
      include: { booking: true },
    });

    if (!payment) {
      logger.error(
        "[Unified Webhook] Payment record not found for Flutterwave transaction reference",
        {
          flutterwaveReference,
          refundId,
        },
      );
      return Response.json({ error: "Payment not found" }, { status: 404 });
    }

    if (!payment.booking) {
      logger.error("[Unified Webhook] No associated booking found for payment", {
        paymentId: payment.id,
        flutterwaveReference,
        refundId,
      });
      return Response.json({ error: "Booking not found for payment" }, { status: 404 });
    }

    logger.info("[Unified Webhook] Payment and booking found, updating status to REFUNDED", {
      paymentId: payment.id,
      bookingId: payment.booking.id,
      refundId,
      currentPaymentStatus: payment.status,
      currentBookingPaymentStatus: payment.booking.paymentStatus,
    });

    // Update payment and booking status to REFUNDED
    await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: { status: "REFUNDED" },
      }),
      prisma.booking.update({
        where: { id: payment.booking.id },
        data: { paymentStatus: "REFUNDED" },
      }),
    ]);

    logger.info("[Unified Webhook] Successfully processed refund - status updated to REFUNDED", {
      bookingId: payment.booking.id,
      paymentId: payment.id,
      refundId,
      amountRefunded: AmountRefunded,
      refundStatus: status,
    });

    // Handle referral reversal on refund
    if (payment.booking.referralStatus !== "NONE") {
      logger.info("[Unified Webhook] Processing referral reversal for refunded booking", {
        bookingId: payment.booking.id,
        referralStatus: payment.booking.referralStatus,
        refundId,
      });

      try {
        await reverseReferralReward(payment.booking.id);
        logger.info("[Unified Webhook] Referral reversal completed for refunded booking", {
          bookingId: payment.booking.id,
          refundId,
        });
      } catch (e) {
        logger.error("[Unified Webhook] Failed to reverse referral on refund", {
          bookingId: payment.booking.id,
          refundId,
          error: e instanceof Error ? e.message : e,
        });
      }
    } else {
      logger.info("[Unified Webhook] No referral reversal needed (referralStatus is NONE)", {
        bookingId: payment.booking.id,
        refundId,
      });
    }
  } catch (error) {
    logger.error("[Unified Webhook] Error processing refund webhook", {
      flutterwaveReference,
      refundId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return Response.json({ error: "Failed to process refund" }, { status: 500 });
  }

  return Response.json({ message: "Refund processed successfully" }, { status: 200 });
}

async function handleTransferCompleted(payload: FlutterwaveTransferCompletedPayload) {
  const {
    data: { id: transferId, status, complete_message: completeMessage, amount },
  } = payload;

  logger.info(`[Transfer Webhook] Handling transfer ${transferId} with status ${status}`);

  const payoutTransaction = await prisma.payoutTransaction.findFirst({
    where: { payoutProviderReference: String(transferId) },
    include: {
      booking: {
        include: {
          car: {
            include: {
              owner: true,
            },
          },
        },
      },
    },
  });

  if (!payoutTransaction) {
    logger.error(`[Transfer Webhook] PayoutTransaction not found for transferId: ${transferId}`);
    // Acknowledge receipt to prevent retries, but log error.
    return Response.json({ error: "Transaction not found" }, { status: 404 });
  }

  let finalStatus: "PAID_OUT" | "FAILED";
  switch (status) {
    case "SUCCESSFUL":
      finalStatus = "PAID_OUT";
      break;
    case "FAILED":
      finalStatus = "FAILED";
      break;
    default:
      logger.warn(
        `[Transfer Webhook] Received unhandled transfer status '${status}' for transfer ${transferId}. No action taken.`,
      );
      // Acknowledge receipt, but take no action.
      return Response.json(
        { message: "Webhook acknowledged, no action taken for this status." },
        { status: 200 },
      );
  }

  await prisma.payoutTransaction.update({
    where: { id: payoutTransaction.id },
    data: {
      status: finalStatus,
      completedAt: new Date(),
      notes: completeMessage || `Transfer completed with status: ${status}`,
    },
  });

  // Also update the parent booking's payout status
  if (payoutTransaction.bookingId) {
    await prisma.booking.update({
      where: { id: payoutTransaction.bookingId },
      data: {
        overallPayoutStatus: finalStatus,
      },
    });
  }

  logger.info(
    `[Transfer Webhook] PayoutTransaction ${payoutTransaction.id} updated to ${finalStatus}`,
  );

  if (finalStatus === "PAID_OUT" && payoutTransaction?.booking?.car?.owner) {
    const owner = payoutTransaction.booking.car.owner;
    const formattedAmount = formatCurrency(amount);

    await emailQueue.add(async () => {
      const html = await renderPayoutNotificationEmail({
        name: owner.name ?? owner.email,
        amount: formattedAmount,
        bookingReference: payoutTransaction?.booking?.bookingReference ?? "",
      });
      await sendEmail({
        to: owner.email,
        subject: "You've received a payout!",
        html,
      });
    });

    logger.info(`[Transfer Webhook] Payout notification queued for ${owner.email}`);
  }

  if (finalStatus === "FAILED") {
    await emailQueue.add(async () => {
      await sendEmail({
        to: "dcodesmith@gmail.com",
        subject: "Payout Failed",
        html: "Payout failed",
      });
    });
  }

  return Response.json({ message: "Transfer webhook processed successfully" }, { status: 200 });
}

// Disable Vercel Authentication for webhook endpoint
export const config = {
  auth: false,
};

export async function action({ request }: ActionFunctionArgs) {
  const contentType = request.headers.get("content-type");
  logger.info(`[Unified Webhook] Content type, ${contentType}`);
  logger.info("[Unified Webhook] Handling webhook");

  const isWebhookVerified = await verifyPaymentWebhook(request.clone());

  if (!isWebhookVerified) {
    logger.error("[Unified Webhook] Webhook verification failed");
    return Response.json({ error: "Webhook verification failed" }, { status: 400 });
  }

  logger.info("[Unified Webhook] Webhook verification successful, processing payload");
  const payload = await request.json();
  logger.info("[Unified Webhook] Received payload", payload);

  // --- Event-based routing ---
  if (isChargeCompletedPayload(payload)) {
    logger.info("[Unified Webhook] Handling charge completed");
    logger.info(payload);
    return handleChargeCompleted(payload);
  }

  if (isRefundPayload(payload)) {
    logger.info("[Unified Webhook] Handling refund completed");
    return handleRefundCompleted(payload);
  }

  if (isTransferCompletedPayload(payload)) {
    logger.info("[Unified Webhook] Handling transfer completed");
    return handleTransferCompleted(payload);
  }

  logger.warn("[Unified Webhook] Received an unhandled event type.");
  // Acknowledge receipt of the webhook even if we don't handle it
  return Response.json({ message: "Event type not handled" }, { status: 200 });
}
