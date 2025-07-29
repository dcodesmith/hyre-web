import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  SESSION_SECRET: z.string(),
  ENCRYPTION_SECRET: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  DEV_HOST_URL: z.string().optional(),
  PROD_HOST_URL: z.string().optional(),
  RESEND_API_KEY: z.string(),
  OPENAI_API_KEY: z.string().optional(),

  FLUTTERWAVE_SECRET_KEY: z.string(),
  FLUTTERWAVE_PUBLIC_KEY: z.string(),
  FLUTTERWAVE_ENCRYPTION_KEY: z.string().optional(),
  FLUTTERWAVE_WEBHOOK_SECRET: z.string().optional(),
  FLUTTERWAVE_WEBHOOK_URL: z.string().url(),

  TWILIO_ACCOUNT_SID: z.string(),
  TWILIO_AUTH_TOKEN: z.string(),
  TWILIO_SECRET: z.string(),
  TWILIO_WHATSAPP_NUMBER: z.coerce.number(),
  TWILIO_WEBHOOK_URL: z.string().optional(),

  AWS_ACCESS_KEY_ID: z.string(),
  AWS_SECRET_ACCESS_KEY: z.string(),
  AWS_REGION: z.string(),
  AWS_BUCKET_NAME: z.string(),
  APP_NAME: z.string(),

  SUPPORT_EMAIL: z.string().optional(),
  WEBSITE_URL: z.string().optional(),
  DOMAIN: z.string().optional(),
});

// declare global {
//   namespace NodeJS {
//     interface ProcessEnv extends z.infer<typeof schema> {}
//   }
// }
let validatedEnv: z.infer<typeof schema>; // module-level cache

export function initEnvs() {
  if (typeof process === "undefined" || !process.env) {
    throw new Error("Environment variables are not available");
  }

  const parsed = schema.safeParse(process.env);

  if (!parsed.success) {
    console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment variables.");
  }

  // biome-ignore lint/suspicious/noConsoleLog: <explanation>
  console.log("Environment variables validated successfully");

  validatedEnv = parsed.data; // cache for later use
  return validatedEnv;
}

export const env = initEnvs();

/**
 * Exports shared environment variables.
 * Do *NOT* add any environment variables that do not wish to be included in the client.
 */
export function getSharedEnvs() {
  return {
    DEV_HOST_URL: env.DEV_HOST_URL,
    PROD_HOST_URL: env.PROD_HOST_URL,
    APP_NAME: env.APP_NAME,
  };
}

export type ENV = ReturnType<typeof getSharedEnvs>;

declare global {
  namespace NodeJS {
    interface ProcessEnv extends z.infer<typeof schema> {}
  }

  let ENV: ENV;
  interface Window {
    ENV: ENV;
  }
}
