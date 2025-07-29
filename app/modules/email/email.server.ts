import { z } from "zod";
import { renderAuthEmail } from "./templates/auth-email";
import logger from "~/lib/logger.server";
import { env } from "~/utils/server/env.server";

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
  const from = `Damola from ${env.APP_NAME} <no-reply@dcodesmith.com>`;
  const email = { from, ...options };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(email),
  });

  const data = await response.json();
  const parsedData = ResendSuccessSchema.safeParse(data);

  if (response.ok && parsedData.success) {
    const emailData = {
      to: options.to,
      subject: options.subject,
      id: parsedData.data.id,
    };
    logger.info("Email sent successfully", emailData);
    return { status: "success", data: parsedData } as const;
  }

  const parseResult = ResendErrorSchema.safeParse(data);

  if (parseResult.success) {
    // need to look into this
    console.error(parseResult.data);
    throw new Error("Unable to send email.");
  }
  logger.error("Unable to send email.", data);
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
    subject: `${env.APP_NAME} ${intent === "login" ? "Login" : "Registration"} Code`,
    html,
  });
}
