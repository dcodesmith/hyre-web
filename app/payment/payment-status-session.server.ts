import { env } from "cloudflare:workers";
import { z } from "zod";

import { readCookieValue } from "~/auth/pending-otp";

const LOCAL_SECRET = "hyre-web-local-payment-status-cookie";
const MIN_MAX_AGE_SECONDS = 5 * 60;
const DEFAULT_MAX_AGE_SECONDS = 30 * 60;
const MAX_AGE_SECONDS = 60 * 60;
const EXPIRY_GRACE_MS = 10 * 60 * 1000;

const paymentStatusSessionSchema = z.object({
  bookingId: z.string().min(1),
  txRef: z.string().min(1),
  paymentStatusToken: z.string().min(1).optional(),
  expiresAt: z.number().int().positive(),
});

export type PaymentStatusSession = z.output<typeof paymentStatusSessionSchema>;

type PaymentStatusEnv = typeof env & {
  WEB_SESSION_SECRET?: string;
};

function isSecureCookie() {
  return env.APP_ORIGIN.startsWith("https://");
}

function cookieName() {
  return isSecureCookie() ? "__Host-payment_status" : "payment_status";
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

function toBase64Url(bytes: Uint8Array) {
  const binary = Array.from(bytes, (byte) => String.fromCodePoint(byte)).join("");
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(value: string) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.codePointAt(0) ?? 0);
}

async function encryptionKey(secret: string) {
  const material = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", material, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encryptSession(session: PaymentStatusSession) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await encryptionKey(requirePaymentStatusCookieSecret()),
    new TextEncoder().encode(JSON.stringify(session)),
  );
  return `${toBase64Url(iv)}.${toBase64Url(new Uint8Array(encrypted))}`;
}

async function decryptSession(value: string) {
  const [ivValue, encryptedValue] = value.split(".");

  if (!ivValue || !encryptedValue) {
    return null;
  }

  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64Url(ivValue) },
      await encryptionKey(requirePaymentStatusCookieSecret()),
      fromBase64Url(encryptedValue),
    );
    const session = paymentStatusSessionSchema.parse(
      JSON.parse(new TextDecoder().decode(decrypted)),
    );
    return session.expiresAt > Date.now() ? session : null;
  } catch {
    return null;
  }
}

export function createPaymentStatusSession(
  value: Omit<PaymentStatusSession, "expiresAt"> & { readonly reservationExpiresAt: string },
) {
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
    bookingId: value.bookingId,
    txRef: value.txRef,
    paymentStatusToken: value.paymentStatusToken,
    expiresAt,
  });
}

export async function readPaymentStatusSession(request: Request) {
  const value = readCookieValue(request.headers.get("Cookie"), cookieName());
  return value ? decryptSession(value) : null;
}

export async function paymentStatusSetCookie(session: PaymentStatusSession) {
  const maxAge = Math.max(0, Math.floor((session.expiresAt - Date.now()) / 1000));
  const attributes = [
    `${cookieName()}=${await encryptSession(session)}`,
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

export function paymentStatusClearCookie() {
  const attributes = [`${cookieName()}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];

  if (isSecureCookie()) {
    attributes.push("Secure");
  }

  return attributes.join("; ");
}
