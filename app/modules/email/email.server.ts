import { z } from "zod";
import { renderAuthEmail } from "./templates/auth-email";
import logger from "~/lib/logger.server";

const ResendErrorSchema = z.union([
  z.object({
    name: z.string(),
    message: z.string(),
    statusCode: z.number(),
  }),
  z.object({
    name: z.literal("UnknownError"),
    message: z.literal("Unknown Error"),
    statusCode: z.literal(500),
    cause: z.any(),
  }),
]);
const ResendSuccessSchema = z.object({
  id: z.string(),
});

export type SendEmailOptions = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
};

export async function sendEmail(options: SendEmailOptions) {
  // For development mode, Resend will only accept emails from this domain.
  const from = "Damola from Chauffeurly <damola@dcodesmith.com>"; //"hello@resend.dev";
  const email = { from, ...options };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(email),
  });

  const data = await response.json();
  const parsedData = ResendSuccessSchema.safeParse(data);

  if (response.ok && parsedData.success) {
    logger.info({
      message: "Email sent successfully",
      to: options.to,
      subject: options.subject,
      id: parsedData.data.id,
    });
    return { status: "success", data: parsedData } as const;
  }

  const parseResult = ResendErrorSchema.safeParse(data);

  if (parseResult.success) {
    // need to look into this
    console.error(parseResult.data);
    throw new Error("Unable to send email.");
  }
  console.error(data);
  throw new Error("Unable to send email.");
}

type AuthEmailOptions = {
  email: string;
  code: string;
  magicLink?: string | null;
  intent: "registration" | "login";
};

export async function sendAuthEmail({ email, code, magicLink, intent }: AuthEmailOptions) {
  const html = await renderAuthEmail({ code, magicLink, intent });

  await sendEmail({
    to: email,
    subject: `${process.env.APP_NAME} ${intent === "login" ? "Login" : "Registration"} Code`,
    html,
  });
}
