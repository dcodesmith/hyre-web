import type { User } from "@prisma/client";
import { redirect } from "@remix-run/node";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { emailOTP } from "better-auth/plugins";
import logger from "~/lib/logger.server";
import { prisma } from "~/modules/db/db.server";
import { sendAuthEmail } from "~/modules/email/email.server";
import { userHasRole } from "~/utils/shared/roles";
import { safeRedirect } from "~/utils/safe-redirect";
import { env } from "~/utils/server/env.server";

type SessionUser = {
  id: string;
};

type BetterAuthSession = {
  user: SessionUser | null;
};

const config = {
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  secret: env.SESSION_SECRET,
  baseURL: env.DOMAIN ?? "http://localhost:5173",
  session: {
    // 60 * 60 * 24 * 7 = 604800 seconds (7 days)
    expiresIn: 60 * 60 * 24 * 7,
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
       * OTP Expiry Configuration
       *
       * expiresIn: Time in seconds before the OTP code expires.
       * Default: 300 seconds (5 minutes)
       * Set to 600 seconds (10 minutes) for better UX while maintaining security.
       *
       */
      async sendVerificationOTP({ email, otp, type }) {
        try {
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
};

export const auth = betterAuth(config);

async function getSession(request: Request): Promise<BetterAuthSession | null> {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });
    return session;
  } catch (error) {
    logger.error("Error getting session", { error });
    return null;
  }
}

async function getSessionUserId(request: Request): Promise<string | null> {
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

      throw redirect(safeRedirect(redirectTo, "/logout"));
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

    logger.error("Error in requireUser:", error);
    throw redirect(safeRedirect(redirectTo, "/logout"));
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
    throw redirect("/admin/login");
  }

  return { user, isStaff, isAdmin };
}
