import { env } from "cloudflare:workers";
import { z } from "zod";

import {
  decryptSession as decryptEncryptedSession,
  encryptSession as encryptSessionValue,
  toBase64Url,
} from "~/auth/encrypted-session.server";
import { readCookieValue } from "~/auth/pending-otp";

const LOCAL_SECRET = "hyre-web-local-payment-status-cookie";
const MIN_MAX_AGE_SECONDS = 5 * 60;
const DEFAULT_MAX_AGE_SECONDS = 30 * 60;
const MAX_AGE_SECONDS = 60 * 60;
const EXPIRY_GRACE_MS = 10 * 60 * 1000;

const paymentStatusSessionBaseSchema = z.object({
  bookingId: z.string().min(1),
  txRef: z.string().min(1),
  expiresAt: z.number().int().positive(),
});

const paymentStatusSessionSchema = z.union([
  paymentStatusSessionBaseSchema.extend({
    kind: z.literal("extension"),
    extensionId: z.string().min(1),
  }),
  paymentStatusSessionBaseSchema.extend({
    kind: z.literal("booking").default("booking"),
    paymentStatusToken: z.string().min(1).optional(),
  }),
]);

export type PaymentStatusSession = z.output<typeof paymentStatusSessionSchema>;

type PaymentStatusEnv = typeof env & {
  WEB_SESSION_SECRET?: string;
};

function isSecureCookie() {
  return env.APP_ORIGIN.startsWith("https://");
}

function legacyCookieName() {
  return isSecureCookie() ? "__Host-payment_status" : "payment_status";
}

async function cookieName(txRef: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(txRef));
  const suffix = toBase64Url(new Uint8Array(digest).slice(0, 16));
  return `${legacyCookieName()}-${suffix}`;
}

export function requirePaymentStatusCookieSecret() {
  const configured = (env as PaymentStatusEnv).WEB_SESSION_SECRET?.trim();

  if (configured) {
    return configured;
  }

  if (String(env.APP_ENV) === "local") {
    return LOCAL_SECRET;
  }

  throw new Error("WEB_SESSION_SECRET is required");
}

async function encryptSession(session: PaymentStatusSession) {
  return encryptSessionValue(session, requirePaymentStatusCookieSecret());
}

async function decryptSession(value: string) {
  const session = await decryptEncryptedSession(
    value,
    requirePaymentStatusCookieSecret(),
    paymentStatusSessionSchema,
  );
  return session && session.expiresAt > Date.now() ? session : null;
}

export function createPaymentStatusSession(value: {
  readonly bookingId: string;
  readonly txRef: string;
  readonly paymentStatusToken?: string;
  readonly reservationExpiresAt: string;
}) {
  const now = Date.now();
  const reservationExpiry = Date.parse(value.reservationExpiresAt);
  const defaultExpiry = now + DEFAULT_MAX_AGE_SECONDS * 1000;
  const expiresAt = Number.isNaN(reservationExpiry)
    ? defaultExpiry
    : Math.max(
        now + MIN_MAX_AGE_SECONDS * 1000,
        Math.min(reservationExpiry + EXPIRY_GRACE_MS, now + MAX_AGE_SECONDS * 1000),
      );

  return paymentStatusSessionSchema.parse({
    kind: "booking",
    bookingId: value.bookingId,
    txRef: value.txRef,
    paymentStatusToken: value.paymentStatusToken,
    expiresAt,
  });
}

export function createExtensionPaymentStatusSession(value: {
  readonly bookingId: string;
  readonly extensionId: string;
  readonly txRef: string;
}) {
  return paymentStatusSessionSchema.parse({
    kind: "extension",
    ...value,
    expiresAt: Date.now() + DEFAULT_MAX_AGE_SECONDS * 1000,
  });
}

export async function readPaymentStatusSession(request: Request, txRef: string) {
  const cookieHeader = request.headers.get("Cookie");
  const value =
    readCookieValue(cookieHeader, await cookieName(txRef)) ??
    readCookieValue(cookieHeader, legacyCookieName());
  return value ? decryptSession(value) : null;
}

export async function paymentStatusSetCookie(session: PaymentStatusSession) {
  const maxAge = Math.max(0, Math.floor((session.expiresAt - Date.now()) / 1000));
  const attributes = [
    `${await cookieName(session.txRef)}=${await encryptSession(session)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];

  if (isSecureCookie()) {
    attributes.push("Secure");
  }

  return attributes.join("; ");
}

export async function paymentStatusClearCookies(txRef: string) {
  return Promise.all(
    [await cookieName(txRef), legacyCookieName()].map((name) => {
      const attributes = [`${name}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];

      if (isSecureCookie()) {
        attributes.push("Secure");
      }

      return attributes.join("; ");
    }),
  );
}
