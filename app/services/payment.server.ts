import axios from "axios";
import crypto from "node:crypto";
import logger from "~/lib/logger.server";
import { prisma } from "~/modules/db/db.server";
import { BookingWithRelations } from "~/types";

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
  const FLUTTERWAVE_SECRET_KEY = process.env.FLUTTERWAVE_SECRET_KEY;
  const FLUTTERWAVE_PUBLIC_KEY = process.env.FLUTTERWAVE_PUBLIC_KEY;
  const FLUTTERWAVE_WEBHOOK_SECRET = process.env.FLUTTERWAVE_WEBHOOK_SECRET;

  if (!FLUTTERWAVE_SECRET_KEY || !FLUTTERWAVE_PUBLIC_KEY || !FLUTTERWAVE_WEBHOOK_SECRET) {
    logger.error(`FLUTTERWAVE_SECRET_KEY: ${FLUTTERWAVE_SECRET_KEY}`);
    logger.error(`FLUTTERWAVE_PUBLIC_KEY: ${FLUTTERWAVE_PUBLIC_KEY}`);
    logger.error(`FLUTTERWAVE_WEBHOOK_SECRET: ${FLUTTERWAVE_WEBHOOK_SECRET}`);
    logger.error("Missing Flutterwave API keys");

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
      currency: "NGN", // Or your currency code
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
        logo: "https://yourdomain.com/logo.png", // Your app logo URL
      },
    };

    logger.info(`Payload: ${JSON.stringify(payload, null, 2)}`);

    // Call Flutterwave API to initialize payment
    const response = await axios.post("https://api.flutterwave.com/v3/payments", payload, {
      headers: {
        Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
    });

    if (response.data.status === "success") {
      return {
        paymentIntentId: idempotencyKey, // tx_ref serves as the payment intent ID
        checkoutUrl: response.data.data.link, // The hosted payment page URL
        transactionId: response.data.data.id, // Flutterwave's internal transaction ID
      };
    }

    logger.error(`Failed to create payment intent: ${JSON.stringify(response.data)}`);
    throw new Error("Payment initialization failed");
  } catch (error: unknown) {
    logger.error(
      `Payment intent creation error: ${error instanceof Error ? error.message : String(error)}`,
    );
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
  // Get the Flutterwave signature from the headers
  const signatureFromFlutterwave = request.headers.get("verif-hash"); // This is the header
  const WEBHOOK_SECRET = process.env.FLUTTERWAVE_WEBHOOK_SECRET;

  if (!signatureFromFlutterwave || !WEBHOOK_SECRET) {
    logger.error(`signatureFromFlutterwave: ${signatureFromFlutterwave}`);
    logger.error(`WEBHOOK_SECRET: ${WEBHOOK_SECRET}`);
    logger.error("Webhook security check: Missing signature or configured secret.");
    return false;
  }

  // Simple verification by comparing the signature with your secret
  if (signatureFromFlutterwave === WEBHOOK_SECRET) {
    logger.info("Webhook signature (verif-hash) is VALID.");
    return true;
  }

  logger.warn(
    `Webhook signature (verif-hash) is INVALID. Expected: "${WEBHOOK_SECRET}", Got: "${signatureFromFlutterwave}"`,
  );
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
  const FLUTTERWAVE_SECRET_KEY = process.env.FLUTTERWAVE_SECRET_KEY;

  try {
    const response = await axios.get(
      `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,
      {
        headers: {
          Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
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
      `Transaction verification error: ${error instanceof Error ? error.message : String(error)}`,
    );
    return { verified: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Initiates a refund for a transaction
 */
export async function refundPayment(transactionId: string, amount: number, callbackurl: string) {
  logger.info(`Refunding payment for transactionId: ${transactionId}`);
  logger.info(`Amount: ${amount}`);
  logger.info(`Callback URL: ${callbackurl}`);

  const FLUTTERWAVE_SECRET_KEY = process.env.FLUTTERWAVE_SECRET_KEY;

  try {
    const payload = { amount, callbackurl };

    const response = await axios.post(
      `https://api.flutterwave.com/v3/transactions/${transactionId}/refund`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      },
    );

    logger.info(`Refund response: ${JSON.stringify(response.data, null, 2)}`);

    if (response.data.status === "success") {
      return {
        success: true,
        refundId: response.data.data.id,
        amount: response.data.data.amount_refunded,
        status: response.data.data.status,
      };
    }

    return { success: false, message: response.data.message };
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      const errorMessage =
        error.response?.data?.message || "An error occurred during the refund process.";
      logger.error(
        `[Flutterwave Refund] API error: ${errorMessage} - Response: ${JSON.stringify(
          error.response?.data,
          null,
          2,
        )}`,
      );
      return { success: false, error: errorMessage };
    }

    logger.error(`[Flutterwave Refund] Unknown error: ${String(error)}`);
    return { success: false, error: "An unknown error occurred" };
  }
}

/**
 * Verifies a refund's status directly with Flutterwave
 */
export async function verifyRefund(refundId: string) {
  const FLUTTERWAVE_SECRET_KEY = process.env.FLUTTERWAVE_SECRET_KEY;

  try {
    const response = await axios.get(`https://api.flutterwave.com/v3/refunds/${refundId}`, {
      headers: {
        Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
      },
    });

    if (response.data.status === "success" && response.data.data.status === "successful") {
      return {
        verified: true,
        amount: response.data.data.amount_refunded,
        refundId: response.data.data.id,
        transactionId: response.data.data.transaction_id,
        status: response.data.data.status,
      };
    }

    return { verified: false, status: response.data.data?.status };
  } catch (error: unknown) {
    logger.error(
      `Refund verification error: ${error instanceof Error ? error.message : String(error)}`,
    );
    return { verified: false, error: error instanceof Error ? error.message : String(error) };
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
  const FLUTTERWAVE_SECRET_KEY = process.env.FLUTTERWAVE_SECRET_KEY;
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
    callback_url: `${process.env.APP_URL || process.env.NGROK_DOMAIN}/api/payments/webhook/flutterwave`,
    debit_currency: "NGN",
  };

  try {
    logger.info(
      `payout request: ${JSON.stringify({
        method: "POST",
        url: "https://api.flutterwave.com/v3/transfers",
        data: payload,
        headers: {
          Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      })}`,
    );

    const response = await axios.post("https://api.flutterwave.com/v3/transfers", payload, {
      headers: {
        Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
    });

    logger.info(`Flutterwave transfer initiation response: ${JSON.stringify(response.data)}`);

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
    // biome-ignore lint/suspicious/noConsoleLog: <explanation>
    console.log(error);
    logger.error(`Failed to initiate payout via Flutterwave: ${error}`);
    if (axios.isAxiosError(error) && error.response) {
      // biome-ignore lint/suspicious/noConsoleLog: <explanation>
      console.log(error.response);
      logger.error(`Flutterwave error response: ${JSON.stringify(error.response.data)}`);
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
  // Check if a payout is already in progress
  const existingPayout = await prisma.payoutTransaction.findFirst({
    where: {
      bookingId: booking.id,
      status: { in: ["PENDING_DISBURSEMENT", "PROCESSING"] },
    },
  });

  if (existingPayout) {
    logger.info(`Payout already in progress for booking ${booking.id}`);
    return;
  }

  if (!booking.fleetOwnerPayoutAmountNet || booking.fleetOwnerPayoutAmountNet.isZero()) {
    logger.info(`Booking ${booking.id} has no payout amount. Skipping payout.`);
    return;
  }

  const fleetOwner = booking.car.owner;
  if (!fleetOwner.bankDetailsId) {
    logger.warn(
      `Fleet owner ${fleetOwner.id} has no bank details. Cannot process payout for booking ${booking.id}.`,
    );
    return;
  }

  const bankDetails = await prisma.bankDetails.findUnique({
    where: { id: fleetOwner.bankDetailsId },
  });

  if (!bankDetails || !bankDetails.isVerified) {
    logger.warn(
      `Bank details for fleet owner ${fleetOwner.id} not found or not verified. Cannot process payout for booking ${booking.id}.`,
    );
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
  if (payoutResult.success) {
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
    logger.info(
      `Payout for booking ${booking.id} initiated successfully. Transaction ID: ${payoutTransaction.id}`,
    );
  } else {
    payoutTransaction = await prisma.payoutTransaction.update({
      where: { id: payoutTransaction.id },
      data: {
        status: "FAILED",
        notes: `Flutterwave initiation failed: ${payoutResult.data.message}`,
      },
    });
    await prisma.booking.update({
      where: { id: booking.id },
      data: { overallPayoutStatus: "FAILED" },
    });
    logger.error(
      `Payout initiation for booking ${booking.id} failed. Reason: ${payoutResult.data.message}`,
    );
  }
}
