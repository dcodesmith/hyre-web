import { createAuthClient } from "better-auth/client";
import { emailOTPClient } from "better-auth/client/plugins";

/**
 * Better Auth Client SDK
 *
 * This client is used for browser-initiated authentication requests.
 * It sends requests directly to /api/auth/* endpoints, which are:
 * - Rate-limited by better-auth configuration
 * - Handled by the auth.handler in api.auth.$.tsx
 *
 * DO NOT use this in server-side code (loaders/actions).
 * For server-side operations, use auth.api.* from auth.server.ts instead.
 */
export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : "http://localhost:5173",
  plugins: [emailOTPClient()],
});
