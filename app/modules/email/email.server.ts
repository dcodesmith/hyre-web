import { z } from "zod";
import { renderAuthEmail } from "./templates/auth-email";

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
  const from = "hello@resend.dev";
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
    return { status: "success", data: parsedData } as const;
  }

  const parseResult = ResendErrorSchema.safeParse(data);

  if (parseResult.success) {
    // need to look into this
    console.error(parseResult.data);
    throw new Error("Unable to send email.");
  } else {
    console.error(data);
    throw new Error("Unable to send email.");
  }
}

type AuthEmailOptions = {
  email: string;
  code: string;
  magicLink?: string | null;
};

export async function sendAuthEmail({
  email,
  code,
  magicLink,
}: AuthEmailOptions) {
  const html = await renderAuthEmail({ email, code, magicLink });

  await sendEmail({
    to: email,
    subject: `${process.env.APP_NAME} Login Code`,
    html,
  });
}
