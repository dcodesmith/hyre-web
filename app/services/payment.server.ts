import axios from "axios";
import crypto from "node:crypto";
import logger from "~/lib/logger.server";
import { isE2ETesting } from "~/modules/auth/otp-test-store.server";
import { prisma } from "~/modules/db/db.server";
import { BookingWithRelations } from "~/types";
import { env } from "~/utils/server/env.server";

type CustomerInfo = {
  email: string;
  name?: string;
  phone_number?: string;
};

type PaymentIntentOptions = {
  amount: number;
  customer: CustomerInfo;
  metadata?: Record<string, any>;
  idempotencyKey?: string;
  callbackUrl: string;
};

/**
 * Creates a payment intent with Flutterwave and returns the payment intent ID and checkout URL
 */
export async function createPaymentIntent({
  amount,
  customer,
  metadata = {},
  idempotencyKey = crypto.randomUUID(),
  callbackUrl,
}: PaymentIntentOptions) {
  if (isE2ETesting()) {
    const tx_ref = idempotencyKey;
    const mockCallbackUrl = new URL(callbackUrl);
    mockCallbackUrl.searchParams.set("tx_ref", tx_ref);
    mockCallbackUrl.searchParams.set("status", "successful");
    mockCallbackUrl.searchParams.set("transaction_id", `test-${tx_ref}`);

    logger.info("[E2E Mock] Returning mock payment intent", { tx_ref, amount });
    return {
      paymentIntentId: tx_ref,
      checkoutUrl: mockCallbackUrl.toString(),
      transactionId: `test-${tx_ref}`,
    };
  }

  const { FLUTTERWAVE_SECRET_KEY, FLUTTERWAVE_PUBLIC_KEY, FLUTTERWAVE_WEBHOOK_SECRET } = env;

  if (!FLUTTERWAVE_SECRET_KEY || !FLUTTERWAVE_PUBLIC_KEY || !FLUTTERWAVE_WEBHOOK_SECRET) {
    const missingKeys = {
      secretKey: FLUTTERWAVE_SECRET_KEY ? "present" : "missing",
      publicKey: FLUTTERWAVE_PUBLIC_KEY ? "present" : "missing",
      webhookSecret: FLUTTERWAVE_WEBHOOK_SECRET ? "present" : "missing",
    };
    logger.error("Missing Flutterwave API keys", missingKeys);
    throw new Error("Payment service configuration error");
  }

  try {
    // Format amount to two decimal places
    const formattedAmount = Number.parseFloat(amount.toFixed(2));
    const tx_ref = idempotencyKey;

    // Create the payment payload
    const payload = {
      tx_ref,
      amount: formattedAmount,
      currency: "NGN",
      redirect_url: callbackUrl,
      customer: {
        email: customer.email,
        name: customer.name || "Customer",
        phonenumber: customer.phone_number,
      },
      meta: {
        ...metadata,
        idempotencyKey,
        tx_ref,
      },
      customizations: {
        title: metadata.transactionType === "booking_creation" ? "Booking" : "Booking Extension",
        description:
          metadata.transactionType === "booking_creation"
            ? "Payment for booking "
            : "Payment for booking extension",
        logo: "https://yourdomain.com/logo.png",
      },
    };

    logger.debug("Payment intent payload", payload);

    // Call Flutterwave API to initialize payment
    const response = await axios.post("https://api.flutterwave.com/v3/payments", payload, {
      headers: {
        Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
    });

    if (response.data.status === "success") {
      return {
        paymentIntentId: idempotencyKey,
        checkoutUrl: response.data.data.link,
        transactionId: response.data.data.id,
      };
    }

    logger.error("Failed to create payment intent", response.data);
    throw new Error("Payment initialization failed");
  } catch (error: unknown) {
    logger.error("Payment intent creation error", {
      error: error instanceof Error ? error.message : String(error),
    });
    if (error instanceof Error && "response" in error) {
      const axiosError = error as any;
      throw new Error(axiosError.response?.data?.message || "Failed to initialize payment");
    }
    throw new Error("Failed to initialize payment");
  }
}

/**
 * Verifies that a webhook request is authentic by validating the signature
 */
export async function verifyPaymentWebhook(request: Request) {
  const signatureFromFlutterwave = request.headers.get("verif-hash");
  const WEBHOOK_SECRET = env.FLUTTERWAVE_WEBHOOK_SECRET;

  if (!signatureFromFlutterwave || !WEBHOOK_SECRET) {
    logger.error("Webhook security check: Missing signature or configured secret", {
      signaturePresent: !!signatureFromFlutterwave,
      secretPresent: !!WEBHOOK_SECRET,
    });
    return false;
  }

  if (signatureFromFlutterwave === WEBHOOK_SECRET) {
    logger.info("Webhook signature (verif-hash) is VALID");
    return true;
  }

  logger.warn("Webhook signature (verif-hash) is INVALID", {
    expected: WEBHOOK_SECRET,
    received: signatureFromFlutterwave,
  });
  return false;
}

/**
 * Verifies a payment transaction's status directly with Flutterwave
 */
export async function verifyTransaction(
  transactionId: string,
  expectedValues?: {
    amount: number;
    currency: string;
    tx_ref: string;
  },
) {
  try {
    const response = await axios.get(
      `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,
      {
        headers: {
          Authorization: `Bearer ${env.FLUTTERWAVE_SECRET_KEY}`,
        },
      },
    );

    const { status, data } = response.data;

    // Base verification – Flutterwave reports success
    let verified = status === "success" && data.status === "successful";

    const mismatchReasons: string[] = [];

    if (verified && expectedValues) {
      const { amount, currency, tx_ref } = expectedValues;

      if (typeof amount === "number" && Number(data.amount) !== Number(amount)) {
        verified = false;
        mismatchReasons.push(`amount mismatch (expected ${amount}, got ${data.amount})`);
      }

      if (currency && data.currency !== currency) {
        verified = false;
        mismatchReasons.push(`currency mismatch (expected ${currency}, got ${data.currency})`);
      }

      if (tx_ref && data.tx_ref !== tx_ref) {
        verified = false;
        mismatchReasons.push(`tx_ref mismatch (expected ${tx_ref}, got ${data.tx_ref})`);
      }
    }

    return {
      verified,
      amount: data.amount,
      currency: data.currency,
      tx_ref: data.tx_ref,
      transactionId: data.id,
      customerEmail: data.customer?.email,
      metadata: data.meta,
      mismatch: mismatchReasons.length ? mismatchReasons.join("; ") : undefined,
    };
  } catch (error: unknown) {
    logger.error(
      `Transaction verification failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return { verified: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Initiates a refund for a transaction
 */
export async function refundPayment(transactionId: string, amount: number, callbackurl: string) {
  logger.info("[Flutterwave Refund] Initiating refund", {
    transactionId,
    amount,
    callbackurl,
  });

  try {
    const payload = { amount, callbackurl };
    const response = await axios.post(
      `https://api.flutterwave.com/v3/transactions/${transactionId}/refund`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${env.FLUTTERWAVE_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      },
    );

    logger.info("[Flutterwave Refund] API response received", {
      transactionId,
      responseStatus: response.data.status,
      refundId: response.data.data?.id,
      refundStatus: response.data.data?.status,
      amountRefunded: response.data.data?.amount_refunded,
    });

    if (response.data.status === "success") {
      const refundData = {
        success: true,
        refundId: response.data.data.id,
        amount: response.data.data.amount_refunded,
        status: response.data.data.status,
      };

      logger.info("[Flutterwave Refund] Refund initiated successfully", {
        transactionId,
        refundId: refundData.refundId,
        amountRefunded: refundData.amount,
        refundStatus: refundData.status,
      });

      return refundData;
    }

    logger.warn("[Flutterwave Refund] Refund initiation returned non-success status", {
      transactionId,
      status: response.data.status,
      message: response.data.message,
    });

    return { success: false, message: response.data.message };
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      const errorMessage =
        error.response?.data?.message || "An error occurred during the refund process.";
      logger.error("[Flutterwave Refund] API error", {
        error: errorMessage,
        response: error.response?.data,
      });
      return { success: false, error: errorMessage };
    }

    logger.error("[Flutterwave Refund] Unknown error", { error: String(error) });
    return { success: false, error: "An unknown error occurred" };
  }
}

/**
 * Initiates a payout to a fleet owner's bank account via Flutterwave.
 *
 * @param bankDetails The bank details of the fleet owner.
 * @param payoutAmount The amount to be paid out.
 * @param reference A unique reference for this payout transaction.
 * @param bookingId The ID of the booking this payout is for.
 * @returns An object containing the success status and the response data from Flutterwave.
 */
async function initiateFlutterwavePayout(
  bankDetails: { bankCode: string; accountNumber: string },
  payoutAmount: number,
  reference: string,
  bookingId: string,
) {
  const { FLUTTERWAVE_SECRET_KEY } = env;

  if (!FLUTTERWAVE_SECRET_KEY) {
    logger.error("Missing Flutterwave API secret key");
    throw new Error("Payment service configuration error");
  }

  const payload = {
    account_bank: bankDetails.bankCode,
    account_number: bankDetails.accountNumber,
    amount: payoutAmount,
    narration: `Payout for booking ${bookingId}`,
    currency: "NGN",
    reference: reference,
    callback_url: `${env.FLUTTERWAVE_WEBHOOK_URL}/api/payments/webhook/flutterwave`,
    debit_currency: "NGN",
  };

  try {
    logger.info("payout request", {
      method: "POST",
      url: "https://api.flutterwave.com/v3/transfers",
      payload,
    });

    const response = await axios.post("https://api.flutterwave.com/v3/transfers", payload, {
      headers: {
        Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
    });

    logger.info("Flutterwave transfer initiation response", response.data);

    if (response.data.status === "success") {
      return {
        success: true,
        data: response.data.data,
      };
    }
    return {
      success: false,
      data: response.data,
    };
  } catch (error) {
    logger.error("Failed to initiate payout via Flutterwave", {
      error: String(error),
      response: axios.isAxiosError(error) ? error.response?.data : undefined,
    });
    if (axios.isAxiosError(error) && error.response) {
      return { success: false, data: error.response.data };
    }
    return { success: false, data: { message: "An unknown error occurred" } };
  }
}

/**
 * Initiates a payout for a completed booking.
 * It creates a PayoutTransaction record and triggers the actual payout via Flutterwave.
 *
 * @param booking The completed booking object.
 */
export async function initiatePayout(booking: BookingWithRelations) {
  const existingPayout = await prisma.payoutTransaction.findFirst({
    where: {
      bookingId: booking.id,
      status: { in: ["PENDING_DISBURSEMENT", "PROCESSING"] },
    },
  });

  if (existingPayout) {
    logger.info("Payout already in progress for booking", { bookingId: booking.id });
    return;
  }

  if (!booking.fleetOwnerPayoutAmountNet || booking.fleetOwnerPayoutAmountNet.isZero()) {
    logger.info("Booking has no payout amount. Skipping payout", { bookingId: booking.id });
    return;
  }

  const fleetOwner = booking.car.owner;

  // Fetch bank details separately
  const bankDetails = await prisma.bankDetails.findUnique({
    where: { userId: fleetOwner.id },
  });

  if (!bankDetails) {
    logger.warn("Fleet owner has no bank details. Cannot process payout for booking", {
      fleetOwnerId: fleetOwner.id,
      bookingId: booking.id,
    });
    return;
  }

  if (!bankDetails.isVerified) {
    logger.warn("Bank details for fleet owner not verified. Cannot process payout for booking", {
      fleetOwnerId: fleetOwner.id,
      bookingId: booking.id,
      isVerified: bankDetails.isVerified,
    });
    return;
  }

  const payoutAmount = booking.fleetOwnerPayoutAmountNet.toNumber();
  const reference = `payout_${booking.id}_${Date.now()}`;

  // 1. Create a PayoutTransaction record
  let payoutTransaction = await prisma.payoutTransaction.create({
    data: {
      fleetOwnerId: fleetOwner.id,
      bookingId: booking.id,
      amountToPay: payoutAmount,
      currency: "NGN",
      status: "PENDING_DISBURSEMENT",
      payoutMethodDetails: `Bank: ${bankDetails.bankName}, Account: ${bankDetails.accountNumber}`,
    },
  });

  // 2. Initiate the actual payout via Flutterwave
  const payoutResult = await initiateFlutterwavePayout(
    bankDetails,
    payoutAmount,
    reference,
    booking.id,
  );

  // 3. Update the PayoutTransaction and Booking based on the result
  if (payoutResult?.success) {
    payoutTransaction = await prisma.payoutTransaction.update({
      where: { id: payoutTransaction.id },
      data: {
        status: "PROCESSING",
        payoutProviderReference: payoutResult.data.id.toString(),
      },
    });
    await prisma.booking.update({
      where: { id: booking.id },
      data: { overallPayoutStatus: "PROCESSING" },
    });
    logger.info("Payout for booking initiated successfully. Transaction ID", {
      bookingId: booking.id,
      transactionId: payoutTransaction.id,
    });
  } else {
    payoutTransaction = await prisma.payoutTransaction.update({
      where: { id: payoutTransaction.id },
      data: {
        status: "FAILED",
        notes: `Flutterwave initiation failed: ${payoutResult?.data.message}`,
      },
    });
    await prisma.booking.update({
      where: { id: booking.id },
      data: { overallPayoutStatus: "FAILED" },
    });
    logger.error("Payout initiation for booking failed. Reason", {
      bookingId: booking.id,
      reason: payoutResult?.data.message,
    });
  }
}
