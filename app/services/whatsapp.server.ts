import twilio from "twilio";
import { env } from "~/utils/server/env.server";

// --- Configuration ---
// It's highly recommended to use environment variables for security.
// Fallback to placeholders if not set (replace these!).
const accountSid = env.TWILIO_ACCOUNT_SID || "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
const authToken = env.TWILIO_AUTH_TOKEN || "your_auth_token";
const twilioWhatsAppNumber = env.TWILIO_WHATSAPP_NUMBER || "+14155552671"; // Your Twilio WhatsApp #

// --- Template & Recipient Details ---
const recipientWhatsAppNumber = "+15558675310"; // The recipient's # (e.g., your test number)
const templateSid = "HX199f51dda921d5a781b2424b82b931a5"; // <--- IMPORTANT: Your Approved Template SID

// Define the variables for your template.
// The keys ('1', '2', etc.) correspond to the placeholders `{{1}}`, `{{2}}` in your template.
const templateVariables = {
  "1": "Damola Kolawole", // Example: Corresponds to {{1}} in template
  "2": "Toyota Highlander (2017)", // Example: Corresponds to {{2}}
  "3": "26th May 2025 @ 07:00 am", // Example: Corresponds to {{3}}
  "4": "26th May 2025 @ 07:00 pm", // Example: Corresponds to {{4}}
  "5": "Mason Apts, Ikoyi", // Example: Corresponds to {{5}}
  "6": "Lagos Int. Airport", // Example: Corresponds to {{6}}
  "7": "₦130,000.00", // Example: Corresponds to {{7}}
  "8": "Hello", // Example: Corresponds to {{8}}
  "9": "https://www.harrods.com/en-gb/p/golden-goose-leather-ballstar-sneakers-000000000007683463", // Example: Corresponds to {{9}}
};
// --- End Configuration ---

// Input validation (basic)
// if (accountSid.startsWith("ACxxx") || authToken === "your_auth_token") {
//   console.error("Error: Please set your TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.");
//   process.exit(1);
// }
// if (templateSid.startsWith("HXxxx")) {
//   console.error("Error: Please set your WhatsApp Template SID (contentSid).");
//   process.exit(1);
// }

// Initialize Twilio Client
const client = twilio("ACf0ade1a8aad13182d4f6dd3590762f35", "bdd1169e4167eb28362dfdc46cbd1ee6");

/**
 * Sends a WhatsApp message using a pre-approved Twilio template.
 */
async function sendWhatsAppTemplateMessage(): Promise<void> {
  console.log(`Attempting to send template ${templateSid} to ${recipientWhatsAppNumber}...`);

  try {
    const message = await client.messages.create({
      to: "whatsapp:+447788263793", // Recipient number with 'whatsapp:' prefix
      from: "whatsapp:+14155238886", // Your Twilio WhatsApp sender # with 'whatsapp:' prefix
      contentSid: templateSid, // The SID of your approved template
      contentVariables: JSON.stringify(templateVariables), // Variables as a JSON string
      shortenUrls: true,
    });

    console.log(`Message sent successfully! SID: ${message.sid}`);
    console.log(`Status: ${message.status}`);
  } catch (error) {
    console.error("Error sending WhatsApp message:", error);
  }
}

// Run the function
sendWhatsAppTemplateMessage();
