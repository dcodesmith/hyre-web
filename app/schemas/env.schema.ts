import { z } from "zod";

export const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"], {
      message: "NODE_ENV must be one of: development, production, test",
    })
    .default("development"),
  SESSION_SECRET: z.string(),
  SESSION_SECRETS: z.string().optional(),
  ENCRYPTION_SECRET: z.string(),
  DATABASE_URL: z.url().optional(),
  RESEND_API_KEY: z.string(),
  OPENAI_API_KEY: z.string(),

  FLUTTERWAVE_SECRET_KEY: z.string(),
  FLUTTERWAVE_PUBLIC_KEY: z.string(),
  FLUTTERWAVE_ENCRYPTION_KEY: z.string().optional(),
  FLUTTERWAVE_WEBHOOK_SECRET: z.string().optional(),
  FLUTTERWAVE_WEBHOOK_URL: z.url(),

  TWILIO_ACCOUNT_SID: z.string(),
  TWILIO_AUTH_TOKEN: z.string(),
  TWILIO_SECRET: z.string(),
  TWILIO_WHATSAPP_NUMBER: z.coerce.number().int(),
  TWILIO_WEBHOOK_URL: z.url().optional(),

  AWS_ACCESS_KEY_ID: z.string(),
  AWS_SECRET_ACCESS_KEY: z.string(),
  AWS_REGION: z.string(),
  AWS_BUCKET_NAME: z.string(),
  APP_NAME: z.string(),

  CLOUDFRONT_DOMAIN: z.string(),

  GOOGLE_MAPS_API_KEY: z.string(),
  GOOGLE_DISTANCE_MATRIX_API_KEY: z.string(),

  FLIGHTAWARE_API_KEY: z.string(),
  FLIGHTAWARE_WEBHOOK_SECRET: z.string(),

  SUPPORT_EMAIL: z.string().optional(),
  WEBSITE_URL: z.url().optional(),
  DOMAIN: z.string(),

  MAINTENANCE_MODE: z.enum(["true", "false"]).optional().default("false"),
});
