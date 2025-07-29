import type { ActionFunctionArgs } from "@remix-run/node"; // or cloudflare/deno
import twilio from "twilio";
import logger from "~/lib/logger.server";
import { env } from "~/utils/server/env.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    logger.warn("Received non-POST request to Twilio webhook.");
    return new Response("Method Not Allowed", { status: 405 });
  }

  const authToken = env.TWILIO_AUTH_TOKEN;
  const webhookUrl = env.TWILIO_WEBHOOK_URL; // Use the configured URL for validation
  const twilioSignature =
    request.headers.get("x-twilio-signature") ?? request.headers.get("x-twilio-signature-256");

  if (!authToken) {
    logger.error("TWILIO_AUTH_TOKEN environment variable is not set.");
    return new Response("Internal Server Error: Missing Auth Token", { status: 500 });
  }

  if (!webhookUrl) {
    logger.error("TWILIO_WEBHOOK_URL environment variable is not set.");
    return new Response("Internal Server Error: Missing Webhook URL", { status: 500 });
  }

  if (!twilioSignature) {
    logger.warn("Received webhook request without X-Twilio-Signature.");
    return new Response("Forbidden: Missing Signature", { status: 403 });
  }

  // --- 3. Parse Form Data ---
  // Twilio sends data as 'application/x-www-form-urlencoded'.
  // Remix's request.formData() handles this.
  const formData = await request.formData();
  const params = Object.fromEntries(formData.entries());

  // --- 4. Validate the Request (CRUCIAL!) ---
  // We use the configured WEBHOOK_URL because `request.url` might differ
  // due to proxies or deployment specifics. Ensure WEBHOOK_URL matches
  // EXACTLY what you configure in Twilio.
  const isTwilioRequest = twilio.validateRequest(
    authToken,
    twilioSignature,
    webhookUrl, // Use the *configured* URL
    params as { [key: string]: string }, // Cast needed for validateRequest
  );

  if (!isTwilioRequest) {
    logger.warn("Received unvalidated/forged Twilio status callback request.");
    return new Response("Forbidden: Invalid Signature", { status: 403 });
  }

  // --- 5. Process the Validated Status Update ---
  const messageSid = params.MessageSid as string;
  const messageStatus = params.MessageStatus as string;
  const errorCode = params.ErrorCode as string | undefined; // Might be undefined
  const to = params.To as string;
  const from = params.From as string;

  logger.info(
    `[Twilio Webhook] SID: ${messageSid}, Status: ${messageStatus}${errorCode ? `, ErrorCode: ${errorCode}` : ""}`,
  );
  const safeParams = { ...params, To: "***redacted***", From: "***redacted***" };
  logger.debug("Raw Twilio params:", safeParams);

  try {
    // =================================================================
    // TODO: ADD YOUR BUSINESS LOGIC HERE!
    // - Find the message/order/user in your database using `messageSid`.
    // - Update its status to `messageStatus`.
    // - If `messageStatus` is 'failed' or 'undelivered', store `errorCode`.
    // - Trigger notifications or other actions if needed.
    // Example:
    // await db.updateMessageStatus(messageSid, messageStatus, errorCode);
    // =================================================================

    // --- 6. Respond to Twilio ---
    // Twilio expects a 200 OK response, optionally with TwiML.
    // An empty <Response> is standard for status webhooks.
    return new Response("<Response></Response>", {
      status: 200,
      headers: { "Content-Type": "application/xml" },
    });
  } catch (dbError: unknown) {
    logger.error(`[Twilio Webhook] Error processing SID ${messageSid}:`, {
      error: dbError instanceof Error ? dbError.message : String(dbError),
    });
    // Still return 200 OK to Twilio to prevent retries for *our* error,
    // but log it heavily so we can fix it. If Twilio gets 500, it will retry.
    // You might *want* retries, in which case return 500.
    return new Response("<Response></Response>", {
      status: 200, // Or 500 if you want Twilio to retry
      headers: { "Content-Type": "application/xml" },
    });
  }
};

// You generally don't need a loader for a POST-only webhook
// export const loader = () => { throw new Response(null, { status: 404 }); };
