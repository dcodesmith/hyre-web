import type { PaymentAttemptStatus, Prisma } from "@prisma/client";
import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import logger from "~/lib/logger.server";
import {
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
import { activateBooking, findBookingByPaymentIntent } from "~/services/bookings.server";
import { activateExtension, findExtensionByPaymentIntent } from "~/services/extensions.server";
import { verifyPaymentWebhook, verifyTransaction } from "~/services/payment.server";
import {
  isChargeCompletedPayload,
  isRefundPayload,
  isTransferCompletedPayload,
  type FlutterwaveChargeCompletedPayload,
  type FlutterwaveRefundPayload,
  type FlutterwaveTransferCompletedPayload,
} from "~/types/flutterwave";

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
    await prisma.booking.updateMany({
      where: { paymentIntent, status: "PENDING" },
      data: { status: "CANCELLED" },
    });
    logger.info(`[Unified Webhook] Booking ${paymentIntent} cancelled.`);
  } else if (transactionType === "booking_extension") {
    await prisma.extension.updateMany({
      where: { paymentIntent, status: "PENDING" },
      data: { status: "CANCELLED" },
    });
    logger.info(`[Unified Webhook] Extension ${paymentIntent} cancelled.`);
  }
}

async function handleChargeCompleted(payload: FlutterwaveChargeCompletedPayload) {
  const { data, meta_data } = payload;
  const { status, tx_ref: paymentIntent, id: transactionId } = data;
  const transactionType = meta_data.transactionType ?? "";

  logger.info(
    `[Unified Webhook] Details: Type: ${transactionType}, Status: ${status}, PaymentIntent: ${paymentIntent}, TransactionID: ${transactionId}`,
  );

  // Ensure critical variables are strings
  const currentStatus = String(status);
  const currentPaymentIntent = String(paymentIntent);
  const currentTransactionId = String(transactionId);

  // Create or update payment record
  await createOrUpdatePaymentRecord(payload);

  if (currentStatus !== "successful") {
    logger.warn(
      `[Unified Webhook] Payment not successful for ${transactionType} - PaymentIntent: ${currentPaymentIntent}, Status: ${currentStatus}`,
    );

    await handleFailedPayment(currentPaymentIntent, transactionType);
    return json({ message: "Payment not successful, transaction cancelled." });
  }

  logger.info(
    `[Unified Webhook] Payment IS successful for ${transactionType} - PaymentIntent: ${currentPaymentIntent}`,
  );

  logger.info(
    `[Unified Webhook] Verifying transaction ${currentTransactionId} with Flutterwave API.`,
  );

  const expectedAmount = Number(meta_data?.amount ?? data.amount ?? 0);
  const expectedCurrency = String(meta_data?.currency ?? data.currency ?? "NGN");

  const verificationResult = await verifyTransaction(currentTransactionId, {
    amount: expectedAmount,
    currency: expectedCurrency,
    tx_ref: currentPaymentIntent,
  });

  if (!verificationResult.verified) {
    logger.error(
      `[Unified Webhook] Failed to verify ${transactionType} transaction ${currentTransactionId} with Flutterwave API. Reason(s): ${verificationResult.mismatch ?? "unknown"}`,
    );

    return json({ error: "Transaction verification failed" }, { status: 400 });
  }

  logger.info(
    `[Unified Webhook] Transaction ${currentTransactionId} successfully verified with Flutterwave API.`,
  );

  // --- Transaction Type Specific Logic ---
  try {
    if (transactionType === "booking_creation") {
      logger.info(`[Unified Webhook] Processing booking_creation for ${currentPaymentIntent}`);

      const pendingBooking = await findBookingByPaymentIntent(currentPaymentIntent);

      if (!pendingBooking) {
        logger.error(`[Unified Webhook] Pending booking not found for ${currentPaymentIntent}`);
        return json({ error: "Booking not found" }, { status: 404 });
      }

      logger.info(`[Unified Webhook] Found pending booking ${pendingBooking.id}`);

      const booking = await activateBooking(pendingBooking.id, currentTransactionId);

      logger.info(`[Unified Webhook] Activated booking ${booking.id}`);

      const { email } = getCustomerDetails(booking);
      const bookingDetails = normaliseBookingDetails(booking);
      const html = await renderBookingConfirmationEmail(bookingDetails);

      emailQueue.add(async () => {
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
          templateKey: Template.BookingConfirmation,
        });

        await sendEmail({ to: email, subject: "Booking Confirmed", html });
      });

      logger.info(`[Unified Webhook] Booking confirmation email queued for ${email}`);

      emailQueue.add(async () => {
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
          templateKey: Template.FleetOwnerBookingNotification,
        });

        await sendEmail({
          to: booking.car.owner.email,
          subject: "New Booking Alert",
          html: await renderFleetOwnerBookingNotificationEmail(bookingDetails),
        });
      });
      logger.info(
        `[Unified Webhook] Fleet owner notification queued for ${booking.car.owner.email}`,
      );

      logger.info(
        `[Unified Webhook] Booking creation for ${currentPaymentIntent} processed successfully.`,
      );
    } else if (transactionType === "booking_extension") {
      logger.info(`[Unified Webhook] Processing booking_extension for ${currentPaymentIntent}`);

      const pendingExtension = await findExtensionByPaymentIntent(currentPaymentIntent);

      if (!pendingExtension) {
        logger.error(`[Unified Webhook] Pending extension not found for ${currentPaymentIntent}`);
        return json({ error: "Extension not found" }, { status: 404 });
      }

      logger.info(
        `[Unified Webhook] Found pending extension ${pendingExtension.id} for booking ${pendingExtension.bookingLeg.booking.id}`,
      );

      const activatedExtension = await activateExtension(
        pendingExtension.id,
        String(currentTransactionId),
      );
      logger.info(`[Unified Webhook] Activated extension ${pendingExtension.id}`);

      const { booking } = activatedExtension.bookingLeg;
      const { email } = getCustomerDetails(booking);
      const extensionDetails = normaliseExtensionDetails(activatedExtension);
      const html = await bookingExtensionConfirmationEmail(extensionDetails);

      logger.info(`[Unified Webhook] Sending extension confirmation email to ${email}`);

      emailQueue.add(async () => {
        await sendMessage({
          variables: {
            "1": extensionDetails.customerName,
            "2": extensionDetails.carName,
            "3": extensionDetails.legDate,
            "4": extensionDetails.extensionHours,
            "5": extensionDetails.from,
            "6": extensionDetails.to,
          },
          templateKey: Template.BookingExtensionConfirmation,
        });
        await sendEmail({ to: email, subject: "Booking Extension Confirmed", html });
      });

      logger.info(`[Unified Webhook] Extension confirmation email queued for ${email}`);

      logger.info(
        `[Unified Webhook] Booking extension for ${currentPaymentIntent} processed successfully.`,
      );
    } else {
      logger.warn(
        `[Unified Webhook] Unknown transactionType: ${transactionType} for ${currentPaymentIntent}`,
      );
      return json({ error: "Unknown transaction type" }, { status: 400 });
    }

    return json({ message: "Webhook processed successfully" });
  } catch (error: unknown) {
    const e = error as Error;
    logger.error(
      `[Unified Webhook] Error processing ${transactionType} for ${currentPaymentIntent}: ${e.message}`,
    );
    logger.error(e.stack);
    return json({ error: "Server error processing webhook" }, { status: 500 });
  }
}

async function handleRefundCompleted(payload: FlutterwaveRefundPayload) {
  const { status, FlwRef: flutterwaveReference } = payload;

  if (status !== "completed") {
    logger.warn(
      `[Unified Webhook] Refund event received but status is not 'completed': ${status}. Ignoring.`,
    );
    return json({ message: "Refund not completed." });
  }

  if (!flutterwaveReference) {
    logger.error(
      "[Unified Webhook] Flutterwave transaction reference (FlwRef) not found in refund payload.",
    );
    return json({ error: "Transaction reference missing" }, { status: 400 });
  }

  try {
    const payment = await prisma.payment.findUnique({
      where: { flutterwaveReference: String(flutterwaveReference) }, // Find payment by original tx_ref
      include: { booking: true },
    });

    if (!payment) {
      logger.error(
        `[Unified Webhook] Payment record not found for Flutterwave transaction reference: ${flutterwaveReference}.`,
      );
      return json({ error: "Payment not found" }, { status: 404 });
    }

    if (!payment.booking) {
      logger.error(`[Unified Webhook] No associated booking found for payment ID: ${payment.id}.`);
      return json({ error: "Booking not found for payment" }, { status: 404 });
    }

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

    logger.info(
      `[Unified Webhook] Successfully processed refund for booking ${payment.booking.id}. Status updated to REFUNDED.`,
    );
  } catch (error) {
    logger.error(`[Unified Webhook] Error processing refund: ${error}`);
    return json({ error: "Failed to process refund" }, { status: 500 });
  }

  return json({ message: "Refund processed successfully" });
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
    return json({ error: "Transaction not found" }, { status: 404 });
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
      return json({ message: "Webhook acknowledged, no action taken for this status." });
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
    const formattedAmount = new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
    }).format(amount);

    emailQueue.add(async () => {
      const html = await renderPayoutNotificationEmail({
        name: owner.name ?? owner.email,
        amount: formattedAmount,
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

  return json({ message: "Transfer webhook processed successfully" });
}

export async function action({ request }: ActionFunctionArgs) {
  const isWebhookVerified = await verifyPaymentWebhook(request.clone());

  if (!isWebhookVerified) {
    logger.error("[Unified Webhook] Webhook verification failed.");
    return json({ error: "Webhook verification failed" }, { status: 400 });
  }

  const payload = await request.json();
  logger.info(`[Unified Webhook] Received payload: ${JSON.stringify(payload)}`);

  // --- Event-based routing ---
  if (isChargeCompletedPayload(payload)) {
    return handleChargeCompleted(payload);
  }

  if (isRefundPayload(payload)) {
    return handleRefundCompleted(payload);
  }

  if (isTransferCompletedPayload(payload)) {
    return handleTransferCompleted(payload);
  }

  logger.warn("[Unified Webhook] Received an unhandled event type.");
  // Acknowledge receipt of the webhook even if we don't handle it
  return json({ message: "Event type not handled" }, { status: 200 });
}
