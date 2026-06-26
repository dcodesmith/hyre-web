import { z } from "zod";
import { resolveEmailProvider } from "~/modules/email/email-provider";

/**
 * Reduces DOMAIN to a bare protocol+host origin (no path, no trailing slash).
 * Garbage (whitespace-only, no host) falls through unchanged so the schema's
 * `.pipe(z.url())` rejects it with a clean error instead of throwing.
 */
export function normalizeSiteOrigin(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return URL.canParse(withProtocol) ? new URL(withProtocol).origin : withProtocol;
}

export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "production", "test"], {
        message: "NODE_ENV must be one of: development, production, test",
      })
      .default("development"),
    VERCEL: z.string().optional(),
    SESSION_SECRET: z.string(),
    SESSION_SECRETS: z.string().optional(),
    ENCRYPTION_SECRET: z.string(),
    DATABASE_URL: z.url(),
    EMAIL_PROVIDER: z.enum(["resend", "smtp", "console"]).optional(),
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().optional(),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    SMTP_SECURE: z.enum(["true", "false"]).optional(),
    OPENAI_API_KEY: z.string(),
    UPSTASH_REDIS_REST_URL: z.string().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
    KV_REST_API_URL: z.string().optional(),
    KV_REST_API_TOKEN: z.string().optional(),

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
    DOMAIN: z.string().min(1).transform(normalizeSiteOrigin).pipe(z.url()),

    MAINTENANCE_MODE: z.enum(["true", "false"]).optional().default("false"),
    RATE_LIMIT_FAIL_OPEN: z.enum(["true", "false"]).optional(),
  })
  .superRefine((value, ctx) => {
    const hasUpstashPair = Boolean(value.UPSTASH_REDIS_REST_URL && value.UPSTASH_REDIS_REST_TOKEN);
    const hasVercelKvPair = Boolean(value.KV_REST_API_URL && value.KV_REST_API_TOKEN);
    const isDevelopment = value.NODE_ENV === "development";

    if (!hasUpstashPair && !hasVercelKvPair && !isDevelopment) {
      ctx.addIssue({
        code: "custom",
        message:
          "Provide Redis credentials via UPSTASH_REDIS_REST_URL/TOKEN or KV_REST_API_URL/TOKEN.",
        path: ["UPSTASH_REDIS_REST_URL"],
      });
    }

    const effectiveEmailProvider = resolveEmailProvider(value);

    if (effectiveEmailProvider === "resend" && !value.RESEND_API_KEY) {
      ctx.addIssue({
        code: "custom",
        message: "RESEND_API_KEY is required when EMAIL_PROVIDER=resend.",
        path: ["RESEND_API_KEY"],
      });
    }
  });
