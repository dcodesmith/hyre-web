import { renderAuthEmail } from "./templates/auth-email";
import nodemailer from "nodemailer";
import logger from "~/lib/logger.server";
import { resolveEmailProvider } from "~/modules/email/email-provider";
import { env } from "~/utils/server/env.server";
import { ResendErrorSchema, ResendSuccessSchema } from "~/schemas/email.schema";

export type SendEmailOptions = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
};

let smtpTransporter: nodemailer.Transporter | null = null;

function getFromAddress() {
  return env.EMAIL_FROM ?? `Yomide from ${env.APP_NAME} <no-reply@dcodesmith.com>`;
}

function getSmtpTransporter() {
  if (smtpTransporter) {
    return smtpTransporter;
  }

  const host = env.SMTP_HOST ?? "127.0.0.1";
  const port = env.SMTP_PORT ?? 1025;

  smtpTransporter = nodemailer.createTransport({
    host,
    port,
    secure: env.SMTP_SECURE === "true" || port === 465,
    auth:
      env.SMTP_USER && env.SMTP_PASS
        ? {
            user: env.SMTP_USER,
            pass: env.SMTP_PASS,
          }
        : undefined,
  });

  return smtpTransporter;
}

async function sendViaResend(options: SendEmailOptions) {
  const email = { from: getFromAddress(), ...options };

  if (!env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is required when EMAIL_PROVIDER=resend.");
  }

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
    return { status: "success", data: parsedData.data } as const;
  }

  const parseResult = ResendErrorSchema.safeParse(data);

  if (parseResult.success) {
    logger.error("Resend email provider returned an error", parseResult.data);
    throw new Error("Unable to send email.");
  }

  logger.error("Unable to send email.", data);
  throw new Error("Unable to send email.");
}

async function sendViaSmtp(options: SendEmailOptions) {
  const transporter = getSmtpTransporter();
  const info = await transporter.sendMail({
    from: getFromAddress(),
    ...options,
  });

  logger.info("Email sent via SMTP", {
    to: options.to,
    subject: options.subject,
    messageId: info.messageId,
    response: info.response,
  });

  return { status: "success" as const, data: { id: info.messageId } };
}

async function sendViaConsole(options: SendEmailOptions) {
  logger.info("Email delivery suppressed (console provider)", {
    to: options.to,
    subject: options.subject,
    preview: options.text ?? options.html.slice(0, 200),
  });
  return { status: "success" as const, data: { id: `console-${Date.now()}` } };
}

export async function sendEmail(options: SendEmailOptions) {
  const provider = resolveEmailProvider(env);

  if (provider === "smtp") {
    return sendViaSmtp(options);
  }

  if (provider === "console") {
    return sendViaConsole(options);
  }

  return sendViaResend(options);
}

type AuthEmailOptions = {
  email: string;
  code: string;
  intent: "registration" | "login";
};

export async function sendAuthEmail({ email, code, intent }: AuthEmailOptions) {
  const html = await renderAuthEmail({ code, intent });

  await sendEmail({
    to: email,
    subject: `${env.APP_NAME} ${intent === "login" ? "Login" : "Registration"} Code`,
    html,
  });
}
