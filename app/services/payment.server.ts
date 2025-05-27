import axios from "axios";
import crypto from "node:crypto";
import logger from "~/lib/logger.server";

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

    // Create the payment payload
    const payload = {
      tx_ref: idempotencyKey,
      amount: process.env.NODE_ENV === "development" ? 3000 : formattedAmount,
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

    logger.info(`Payload: ${JSON.stringify(payload)}`);

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
export async function verifyTransaction(transactionId: string) {
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

    if (response.data.status === "success" && response.data.data.status === "successful") {
      return {
        verified: true,
        amount: response.data.data.amount,
        transactionId: response.data.data.id,
        customerEmail: response.data.data.customer.email,
        metadata: response.data.data.meta,
      };
    }

    return { verified: false };
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
export async function refundPayment(transactionId: string, amount?: number) {
  const FLUTTERWAVE_SECRET_KEY = process.env.FLUTTERWAVE_SECRET_KEY;

  try {
    const payload = {
      amount: amount, // Optional, if not provided, full refund is processed
    };

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

    if (response.data.status === "success") {
      return {
        success: true,
        refundId: response.data.data.id,
        amount: response.data.data.amount,
      };
    }

    return { success: false, message: response.data.message };
  } catch (error: unknown) {
    logger.error(`Refund error: ${error instanceof Error ? error.message : String(error)}`);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
