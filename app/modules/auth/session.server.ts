import { createCookieSessionStorage } from "@remix-run/node";
import { env } from "~/utils/server/env.server";

const rotated = env.SESSION_SECRETS
  ? env.SESSION_SECRETS.split(",")
      .map((secret) => secret.trim())
      .filter(Boolean)
  : [];
const primary = env.SESSION_SECRET ? [env.SESSION_SECRET] : [];
// Newest first: primary first, then older rotated values; dedupe to be safe
const secrets = [...new Set([...primary, ...rotated])];

if (secrets.length === 0) {
  throw new Error("No session secrets configured. Set SESSION_SECRET or SESSION_SECRETS.");
}

export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: process.env.NODE_ENV === "production" ? "__Host-auth" : "_auth",
    sameSite: "lax",
    path: "/",
    httpOnly: true,
    secrets, // newest first
    secure: process.env.NODE_ENV === "production",
    // Set reasonable expiration for sessions (7 days)
    maxAge: 60 * 60 * 24 * 7, // 7 days in seconds
  },
});

export const { getSession, commitSession, destroySession } = sessionStorage;

/**
 * Touch session to extend expiry (rolling expiry without idle timeout)
 * This refreshes the maxAge timer on each request
 */
export async function touchSession(request: Request) {
  const session = await getSession(request.headers.get("Cookie"));
  return commitSession(session);
}
