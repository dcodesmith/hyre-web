import type { User } from "@prisma/client";
import { redirect } from "react-router";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { emailOTP } from "better-auth/plugins";
import logger from "~/lib/logger.server";
import { prisma } from "~/modules/db/db.server";
import { sendAuthEmail } from "~/modules/email/email.server";
import { userHasRole } from "~/utils/shared/roles";
import { safeRedirect } from "~/utils/safe-redirect";
import { env } from "~/utils/server/env.server";
import { storeTestOTP } from "~/modules/auth/otp-test-store.server";

type SessionUser = {
  id: string;
};

type BetterAuthSession = {
  user: SessionUser | null;
};

const baseURL = env.DOMAIN || "http://localhost:5173";

const config = {
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  secret: env.SESSION_SECRET,
  baseURL,
  trustedOrigins: [
    baseURL,
    ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
  ].filter((origin): origin is string => Boolean(origin)),
  session: {
    // 60 * 60 * 24 * 7 = 604800 seconds (7 days)
    expiresIn: 60 * 60 * 24 * 7,
    /**
     * Cookie Cache Configuration
     *
     * Caches session data in a signed cookie to reduce database lookups.
     * Without this, every request hits the database to validate the session.
     *
     * - enabled: true - Activates cookie-based session caching
     * - maxAge: 300 seconds (5 minutes) - How long to trust the cached session
     *   before re-validating against the database
     *
     * Trade-offs:
     * - Pro: Significantly reduces database load and improves response times
     * - Con: Session revocation has up to 5-minute delay (user stays logged in
     *   for up to maxAge after session is revoked in database)
     *
     * Note: Custom session fields added via plugins are NOT cached and will
     * always be fetched from the database.
     */
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
    },
  },
  rateLimit: {
    /**
     * Rate Limiting Configuration
     *
     * Protects against brute force attacks and abuse by limiting request frequency.
     *
     * - enabled: true in production, explicitly enabled in development for testing
     * - window: 60 seconds - time window for counting requests
     * - max: 100 - maximum requests allowed per window per IP
     * - storage: "database" - persists rate limit data in PostgreSQL
     *
     * Custom rules for emailOTP plugin endpoints:
     * - send-verification-otp: 5 attempts per 60 seconds (prevent OTP spam)
     * - check-verification-otp: 10 attempts per 60 seconds (allow typos)
     *
     * When rate limit is exceeded:
     * - Returns 429 (Too Many Requests) status
     * - Includes X-Retry-After header with seconds until retry
     */
    enabled: true,
    window: 60,
    max: 100,
    storage: "database",
    customRules: {
      "/email-otp/send-verification-otp": {
        window: 60,
        max: 5,
      },
      "/email-otp/check-verification-otp": {
        window: 60,
        max: 10,
      },
    },
  },
  advanced: {
    /**
     * Cookie Security Configuration
     *
     * useSecureCookies: Enables Secure flag in production (HTTPS only)
     *
     * cookiePrefix: Uses __Host- prefix in production for enhanced security.
     * The __Host- prefix enforces:
     * - Cookie must have Secure flag (enforced by useSecureCookies)
     * - Cookie must NOT have a Domain attribute (domain-bound to exact host)
     * - Cookie Path must be "/" (applies to entire host)
     *
     * This prevents cookie theft via subdomain attacks and ensures cookies
     * are only accessible on the exact host domain, not subdomains.
     *
     * Reference: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie#cookie_prefixes
     */
    useSecureCookies: env.NODE_ENV === "production",
    cookiePrefix: env.NODE_ENV === "production" ? "__Host-" : "",

    /**
     * Default Cookie Attributes
     *
     * Explicitly sets security attributes for all cookies created by better-auth:
     * - httpOnly: true - Prevents client-side JavaScript access (XSS protection)
     * - secure: true in production - Ensures cookies only sent over HTTPS
     * - sameSite: "lax" - Balances security and usability:
     *   * Allows cookies on same-site requests
     *   * Allows cookies on top-level navigation GET requests (better UX)
     *   * Blocks cookies on cross-site POST requests (CSRF protection)
     *
     * Note: sameSite: "strict" provides maximum security but may break
     * OAuth flows and external redirects. "lax" is recommended for most apps.
     */
    defaultCookieAttributes: {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax" as const,
    },
  },
  telemetry: {
    enabled: env.NODE_ENV === "production",
  },
  plugins: [
    emailOTP({
      /**
       * OTP Security Configuration
       *
       * expiresIn: Time in seconds before the OTP code expires.
       * Default: 300 seconds (5 minutes)
       * Set to 600 seconds (10 minutes) for better UX while maintaining security.
       *
       * allowedAttempts: Maximum number of failed verification attempts per OTP.
       * Default: 5 attempts
       * After this limit, the OTP becomes invalid and user must request a new code.
       * This prevents brute force attacks even if rate limiting is bypassed.
       *
       */
      expiresIn: 600,
      allowedAttempts: 5,
      async sendVerificationOTP({ email, otp, type }) {
        try {
          storeTestOTP(email, otp);

          const user = await prisma.user.findUnique({
            where: { email },
            include: { roles: true },
          });

          const intent: "login" | "registration" = user ? "login" : "registration";

          if (process.env.NODE_ENV === "development") {
            logger.info(`OTP code: ${otp}`);

            if (
              email.endsWith("@admin.com") ||
              email.startsWith("cool.fleetowner") ||
              email.startsWith("nerdy.fleetowner")
            ) {
              return;
            }
          }

          await sendAuthEmail({
            email,
            code: otp,
            intent,
          });
        } catch (error) {
          logger.error("Failed to send verification OTP", {
            type,
            error,
          });
          throw error;
        }
      },
    }),
  ],
} satisfies BetterAuthOptions;

export const auth = betterAuth(config);

async function getSession(request: Request): Promise<BetterAuthSession | null> {
  const maxAttempts = env.NODE_ENV === "development" ? 2 : 1;
  const retryDelayMs = 100;
  const timeoutMs = 1500;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const session = (await Promise.race([
        auth.api.getSession({ headers: request.headers }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Session fetch timed out")), timeoutMs),
        ),
      ])) as BetterAuthSession | null;
      return session;
    } catch (error) {
      if (attempt < maxAttempts - 1) {
        logger.warn("Session fetch failed, retrying once", { error });
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        continue;
      }
      logger.error("Session fetch failed after retry", { error });
      return null;
    }
  }
  return null;
}

export async function getSessionUserId(request: Request): Promise<string | null> {
  const session = await getSession(request);
  return session?.user?.id ?? null;
}

export async function requireUser(
  request: Request,
  { redirectTo }: { redirectTo?: string | null } = {},
): Promise<User & { roles: { name: string }[] }> {
  try {
    const userId = await getSessionUserId(request);

    if (!userId) {
      if (!redirectTo) {
        throw redirect("/auth");
      }

      throw redirect(safeRedirect(redirectTo, "/auth"));
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          select: { name: true },
        },
      },
    });

    if (!user) {
      logger.warn(
        `Session exists for user ${userId} but user not found in database. Clearing session.`,
      );
      throw redirect("/logout");
    }

    return user;
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }

    logger.error("Unexpected error in requireUser:", error);
    // Rethrow unexpected errors so error boundaries can handle them
    // rather than masking server issues behind a logout redirect
    throw error;
  }
}

export async function getSessionUser(
  request: Request,
): Promise<(User & { roles: { name: string }[] }) | null> {
  try {
    const userId = await getSessionUserId(request);
    if (!userId) return null;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          select: { name: true },
        },
      },
    });

    if (!user) {
      logger.warn(`Session exists for user ${userId} but user not found in database.`);
      return null;
    }

    return user;
  } catch (error) {
    logger.error("Error in getSessionUser:", error);
    return null;
  }
}

export async function requireAdminWithRedirect(request: Request) {
  const currentPath = new URL(request.url).pathname;
  const user = await requireUser(request, {
    redirectTo: `/admin/login?redirectTo=${encodeURIComponent(currentPath)}`,
  });

  if (!userHasRole(user, "admin")) {
    throw redirect("/admin/login");
  }

  return user;
}

export async function requireAdminOrStaffWithRedirect(request: Request) {
  const user = await requireUser(request, {
    redirectTo: `/admin/login?${new URLSearchParams({
      redirectTo: new URL(request.url).pathname,
    })}`,
  });

  const isAdmin = userHasRole(user, "admin");
  const isStaff = userHasRole(user, "staff");

  if (!isAdmin && !isStaff) {
    throw new Response("Forbidden", { status: 403 });
  }

  return { user, isStaff, isAdmin };
}

export async function requireAdmin(
  request: Request,
): Promise<User & { roles: { name: string }[] }> {
  const user = await requireUser(request);

  if (!userHasRole(user, "admin") || !userHasRole(user, "staff")) {
    throw Response.json(
      {
        success: false,
        error: "Admin access required",
      },
      { status: 403 },
    );
  }

  return user;
}
