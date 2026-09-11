import { env } from "cloudflare:workers";
import { z } from "zod";

import { decryptSession, encryptSession } from "~/auth/encrypted-session.server";
import { readCookieValue } from "~/auth/pending-otp";

const COOKIE_NAME = "chauffeur_onboarding";
const COOKIE_PATH = "/";

const chauffeurOnboardingSessionSchema = z.object({
  token: z.string().min(1),
  expiresAt: z.number().int().positive(),
});

export type ChauffeurOnboardingSession = z.output<typeof chauffeurOnboardingSessionSchema>;

type ChauffeurOnboardingEnv = typeof env & {
  WEB_SESSION_SECRET?: string;
};

function isSecureCookie() {
  return env.APP_ORIGIN.startsWith("https://");
}

function requireCookieSecret() {
  const configured = (env as ChauffeurOnboardingEnv).WEB_SESSION_SECRET?.trim();

  if (configured) {
    return configured;
  }

  throw new Error("WEB_SESSION_SECRET is required");
}

export function createChauffeurOnboardingSession({
  token,
  expiresAt,
}: {
  readonly token: string;
  readonly expiresAt: string;
}) {
  return chauffeurOnboardingSessionSchema.parse({
    token,
    expiresAt: Date.parse(expiresAt),
  });
}

export async function readChauffeurOnboardingSession(request: Request) {
  const value = readCookieValue(request.headers.get("Cookie"), COOKIE_NAME);

  if (!value) {
    return null;
  }

  const session = await decryptSession(
    value,
    requireCookieSecret(),
    chauffeurOnboardingSessionSchema,
  );

  return session && session.expiresAt > Date.now() ? session : null;
}

export async function chauffeurOnboardingSetCookie(session: ChauffeurOnboardingSession) {
  const maxAge = Math.max(0, Math.floor((session.expiresAt - Date.now()) / 1000));
  const attributes = [
    `${COOKIE_NAME}=${await encryptSession(session, requireCookieSecret())}`,
    `Path=${COOKIE_PATH}`,
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];

  if (isSecureCookie()) {
    attributes.push("Secure");
  }

  return attributes.join("; ");
}

export function chauffeurOnboardingClearCookie() {
  const attributes = [
    `${COOKIE_NAME}=`,
    `Path=${COOKIE_PATH}`,
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];

  if (isSecureCookie()) {
    attributes.push("Secure");
  }

  return attributes.join("; ");
}
