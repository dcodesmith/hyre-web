import twilio, { Twilio } from "twilio";
import { MessageInstance } from "twilio/lib/rest/api/v2010/account/message";
import logger from "~/lib/logger.server";
import { env } from "~/utils/server/env.server";
interface TwilioConfig {
  accountSid: string;
  authToken: string;
  whatsAppNumber: number;
}

function getTwilioConfig(): TwilioConfig {
  const accountSid = env.TWILIO_ACCOUNT_SID;
  const authToken = env.TWILIO_AUTH_TOKEN;
  const whatsAppNumber = env.TWILIO_WHATSAPP_NUMBER;

  if (!accountSid || !authToken || !whatsAppNumber) {
    const missing = [
      !accountSid && "TWILIO_ACCOUNT_SID",
      !authToken && "TWILIO_AUTH_TOKEN",
      !whatsAppNumber && "TWILIO_WHATSAPP_NUMBER",
    ]
      .filter(Boolean)
      .join(", ");

    const errorMessage = `Twilio configuration missing: ${missing}. Please check environment variables.`;
    logger.error("Twilio configuration missing", { missing });
    throw new Error(errorMessage);
  }

  return { accountSid, authToken, whatsAppNumber };
}

export enum Template {
  BookingConfirmation = "bookingConfirmation",
  BookingExtensionConfirmation = "bookingExtensionConfirmation",
  BookingCancellationClient = "bookingCancellationClient",
  BookingCancellationFleetOwner = "bookingCancellationFleetOwner",
  FleetOwnerBookingNotification = "fleetOwnerBookingNotification",
  ChauffeurAssigned = "chauffeurAssigned",
  ChauffeurBookingNotification = "chauffeurBookingNotification",
}

const contentSidMap: Record<Template, string> = {
  [Template.BookingConfirmation]: "HXac9f0b83ee03d47fe2f2969173dac354",
  [Template.BookingExtensionConfirmation]: "HXebb188350408a8673d65216990a1e618",
  [Template.BookingCancellationClient]: "HXd32930f086ad7e2c3ac976e245c314f9",
  [Template.BookingCancellationFleetOwner]: "HX5ad3e909d6c011f24e00f4706a78a90e",
  [Template.FleetOwnerBookingNotification]: "HXaeda40fabb6c33f323c1f101e0a10165",
  [Template.ChauffeurAssigned]: "HXadbe21560eb8f732677a73892de67cb7",
  [Template.ChauffeurBookingNotification]: "HX27cc87e3ed7adb436d2895e94d8edd73",
};

const twilioConfig: TwilioConfig | null = getTwilioConfig();
let twilioClient: Twilio | null = null;

if (twilioConfig?.accountSid && twilioConfig?.authToken) {
  try {
    twilioClient = twilio(twilioConfig.accountSid, twilioConfig.authToken);
    logger.info("Twilio client initialized successfully");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Failed to initialize Twilio client at module load", { error: errorMessage });
  }
} else {
  logger.error(
    "Twilio client could not be initialized due to missing configuration (accountSid or authToken)",
  );
}

export async function sendMessage({
  to,
  variables,
  templateKey,
}: {
  to: string;
  variables: Record<string, string | number>;
  templateKey: Template;
}): Promise<MessageInstance | null> {
  if (!twilioConfig) {
    logger.error("Cannot send WhatsApp message: Twilio configuration is missing");
    return null;
  }

  if (!twilioClient) {
    logger.error(
      "Cannot send WhatsApp message: Twilio client is not initialized. Check logs for initialization errors",
    );
    return null;
  }

  if (!twilioConfig.whatsAppNumber) {
    logger.error("Cannot send WhatsApp message: Twilio WhatsApp sender number is not configured");
    return null;
  }

  const contentSid = contentSidMap[templateKey];

  if (!contentSid) {
    logger.error("Could not find SID for template key", { templateKey });
    return null;
  }

  logger.info(`Attempting to send template '${templateKey}' (${contentSid}) to ${to}...`, {
    recipient: to,
    templateKey,
    contentSid,
  });

  try {
    const message = await twilioClient.messages.create({
      to: `whatsapp:${to}`,
      from: `whatsapp:${twilioConfig.whatsAppNumber}`,
      contentSid,
      contentVariables: JSON.stringify(variables),
    });

    logger.info(`Message sent successfully! SID: ${message.sid}, Status: ${message.status}`, {
      sid: message.sid,
      status: message.status,
      to,
    });
    return message;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error(
      `Error sending WhatsApp message to ${to} using template '${templateKey}': ${errorMessage}`,
      {
        recipient: to,
        templateKey,
        error: errorMessage,
      },
    );

    return null;
  }
}
