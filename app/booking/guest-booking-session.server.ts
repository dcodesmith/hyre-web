import { env } from "cloudflare:workers";
import { z } from "zod";

import { guestBookingAccessTokenSchema } from "~/api/bookings/schema";
import { decryptSession, encryptSession } from "~/auth/encrypted-session.server";
import { readCookieValue } from "~/auth/pending-otp";

const LOCAL_SECRET = "hyre-web-local-guest-booking-cookie";
const guestBookingSessionSchema = z.object({
  bookingId: z.string().min(1),
  token: guestBookingAccessTokenSchema,
  expiresAt: z.number().int().positive(),
});

export type GuestBookingSession = z.output<typeof guestBookingSessionSchema>;

type GuestBookingEnv = typeof env & {
  WEB_SESSION_SECRET?: string;
};

function isSecureCookie() {
  return env.APP_ORIGIN.startsWith("https://");
}

function requireGuestBookingCookieSecret() {
  const configured = (env as GuestBookingEnv).WEB_SESSION_SECRET?.trim();

  if (configured) {
    return configured;
  }

  if (String(env.APP_ENV) === "local") {
    return LOCAL_SECRET;
  }

  throw new Error("WEB_SESSION_SECRET is required");
}

async function cookieName(bookingId: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(bookingId));
  const suffix = Array.from(new Uint8Array(digest).slice(0, 12), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  const name = `guest_booking_${suffix}`;

  return isSecureCookie() ? `__Host-${name}` : name;
}

export function createGuestBookingSession({
  bookingId,
  token,
  accessExpiresAt,
}: {
  readonly bookingId: string;
  readonly token: string;
  readonly accessExpiresAt: string;
}) {
  return guestBookingSessionSchema.parse({
    bookingId,
    token,
    expiresAt: Date.parse(accessExpiresAt),
  });
}

export async function readGuestBookingSession(request: Request, bookingId: string) {
  const value = readCookieValue(request.headers.get("Cookie"), await cookieName(bookingId));

  if (!value) {
    return null;
  }

  const session = await decryptSession(
    value,
    requireGuestBookingCookieSecret(),
    guestBookingSessionSchema,
  );

  return session?.bookingId === bookingId && session.expiresAt > Date.now() ? session : null;
}

export async function guestBookingSetCookie(session: GuestBookingSession) {
  const maxAge = Math.max(0, Math.floor((session.expiresAt - Date.now()) / 1000));
  const attributes = [
    `${await cookieName(session.bookingId)}=${await encryptSession(
      session,
      requireGuestBookingCookieSecret(),
    )}`,
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

export async function guestBookingClearCookie(bookingId: string) {
  const attributes = [
    `${await cookieName(bookingId)}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];

  if (isSecureCookie()) {
    attributes.push("Secure");
  }

  return attributes.join("; ");
}
