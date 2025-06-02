import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import logger from "~/lib/logger.server";
import {
  getCustomerDetails,
  normaliseExtensionDetails,
  normaliseBookingDetails,
} from "~/lib/utils";
import { prisma } from "~/modules/db/db.server";
import { sendEmail } from "~/modules/email/email.server";
import {
  bookingExtensionConfirmationEmail,
  renderBookingConfirmationEmail,
  renderFleetOwnerBookingNotificationEmail,
} from "~/modules/email/templates/booking-notification";
import { Template, sendMessage } from "~/modules/messaging/messaging.server";
import { emailQueue } from "~/queues/email-throttle.server";
import { activateBooking, findBookingByPaymentIntent } from "~/services/bookings.server";
import { activateExtension, findExtensionByPaymentIntent } from "~/services/extensions.server"; // Assuming you have this
import { verifyPaymentWebhook, verifyTransaction } from "~/services/payment.server";

export async function action({ request }: ActionFunctionArgs) {
  logger.info(`[Unified Webhook] Received at ${new Date().toISOString()}`);

  const requestCloneForSig = request.clone();
  const isValidSignature = await verifyPaymentWebhook(requestCloneForSig);

  if (!isValidSignature) {
    logger.error("[Unified Webhook] Invalid payment webhook signature.");
    return json({ error: "Invalid signature" }, { status: 403 });
  }

  logger.info("[Unified Webhook] Signature is VALID.");

  let payload: any;
  try {
    payload = await request.json(); // Use original request here as clone was for sig
    logger.info(`[Unified Webhook] Parsed payload: ${JSON.stringify(payload, null, 2)}`);
  } catch (error: unknown) {
    const e = error as Error;
    logger.error(`[Unified Webhook] Error parsing JSON payload: ${e.message}`);
    return json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const status = payload?.data?.status ?? "";
  const paymentIntent = payload?.data?.tx_ref ?? "";
  const transactionId = payload?.data?.id ?? "";
  const transactionType = payload?.meta_data?.transactionType ?? "";

  logger.info(
    `[Unified Webhook] Details: Type: ${transactionType}, Status: ${status}, PaymentIntent: ${paymentIntent}, TransactionID: ${transactionId}`,
  );

  // Ensure critical variables are strings
  const currentStatus = String(status);
  const currentPaymentIntent = String(paymentIntent);
  const currentTransactionId = String(transactionId);

  if (currentStatus !== "successful") {
    logger.warn(
      `[Unified Webhook] Payment not successful for ${transactionType} - PaymentIntent: ${currentPaymentIntent}, Status: ${currentStatus}`,
    );

    if (transactionType === "booking_creation") {
      await prisma.booking.updateMany({
        where: { paymentIntent: currentPaymentIntent, status: "PENDING" },
        data: { status: "CANCELLED" },
      });
      logger.info(`[Unified Webhook] Booking ${currentPaymentIntent} cancelled.`);
    } else if (transactionType === "booking_extension") {
      await prisma.extension.updateMany({
        where: { paymentIntent: currentPaymentIntent, status: "PENDING" },
        data: { status: "CANCELLED" },
      });

      logger.info(`[Unified Webhook] Extension ${currentPaymentIntent} cancelled.`);
    }

    return json({ message: "Payment not successful, transaction cancelled." });
  }

  logger.info(
    `[Unified Webhook] Payment IS successful for ${transactionType} - PaymentIntent: ${currentPaymentIntent}`,
  );

  logger.info(
    `[Unified Webhook] Verifying transaction ${currentTransactionId} with Flutterwave API.`,
  );

  const verificationResult = await verifyTransaction(currentTransactionId);

  if (!verificationResult.verified) {
    logger.error(
      `[Unified Webhook] Failed to verify ${transactionType} transaction ${currentTransactionId} with Flutterwave API.`,
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
      // 56bf9f8d-eea0-4737-b962-0a6e2ae23215
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
