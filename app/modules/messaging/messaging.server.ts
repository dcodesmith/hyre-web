import twilio, { Twilio } from "twilio";
import { MessageInstance } from "twilio/lib/rest/api/v2010/account/message";
import logger from "~/lib/logger.server";

interface TwilioConfig {
  accountSid: string;
  authToken: string;
  whatsAppNumber: string;
  whatsAppRecipientNumber: string;
}

function getTwilioConfig(): TwilioConfig {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const whatsAppNumber = process.env.TWILIO_WHATSAPP_NUMBER;
  const whatsAppRecipientNumber = process.env.TWILIO_WHATSAPP_RECIPIENT_NUMBER;

  if (!accountSid || !authToken || !whatsAppNumber || !whatsAppRecipientNumber) {
    const missing = [
      !accountSid && "TWILIO_ACCOUNT_SID",
      !authToken && "TWILIO_AUTH_TOKEN",
      !whatsAppNumber && "TWILIO_WHATSAPP_NUMBER",
      !whatsAppRecipientNumber && "TWILIO_WHATSAPP_RECIPIENT_NUMBER",
    ]
      .filter(Boolean)
      .join(", ");

    const errorMessage = `Twilio configuration missing: ${missing}. Please check environment variables.`;
    logger.error("Twilio configuration missing", { missing });
    throw new Error(errorMessage);
  }

  return { accountSid, authToken, whatsAppNumber, whatsAppRecipientNumber };
}

export enum Template {
  BookingConfirmation = "bookingConfirmation",
  BookingExtensionConfirmation = "bookingExtensionConfirmation",
  BookingStatusUpdate = "bookingStatusUpdate",
  BookingCancellationClient = "bookingCancellationClient",
  BookingCancellationFleetOwner = "bookingCancellationFleetOwner",
  FleetOwnerBookingNotification = "fleetOwnerBookingNotification",
  ChauffeurAssigned = "chauffeurAssigned",
  ClientBookingLegStartReminder = "clientBookingLegStartReminder",
  ChauffeurBookingLegStartReminder = "chauffeurBookingLegStartReminder",
  ClientBookingLegEndReminder = "clientBookingLegEndReminder",
  ChauffeurBookingLegEndReminder = "chauffeurBookingLegEndReminder",
}

const contentSidMap: Record<Template, string> = {
  [Template.BookingConfirmation]: "HXac9f0b83ee03d47fe2f2969173dac354",
  [Template.BookingExtensionConfirmation]: "HXebb188350408a8673d65216990a1e618",
  [Template.BookingStatusUpdate]: "HX199f51dda921d5a781b2424b82b931a5",
  [Template.BookingCancellationClient]: "HXd32930f086ad7e2c3ac976e245c314f9",
  [Template.BookingCancellationFleetOwner]: "HX5ad3e909d6c011f24e00f4706a78a90e",
  [Template.FleetOwnerBookingNotification]: "HXaeda40fabb6c33f323c1f101e0a10165",
  [Template.ChauffeurAssigned]: "HXadbe21560eb8f732677a73892de67cb7",
  [Template.ClientBookingLegStartReminder]: "HX862149f716a87ae25ce34151140bfc60",
  [Template.ChauffeurBookingLegStartReminder]: "HX8d44b0747c995713d129d77f4cc3c860",
  [Template.ClientBookingLegEndReminder]: "HX8d44b0xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  [Template.ChauffeurBookingLegEndReminder]: "HX8d44b0xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
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
  to = twilioConfig?.whatsAppRecipientNumber,
  variables,
  templateKey,
}: {
  to?: string;
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

  const recipientNumber = to || twilioConfig.whatsAppRecipientNumber;

  if (!recipientNumber) {
    logger.error(
      "Cannot send WhatsApp message: Recipient number is not provided and no default is configured",
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
