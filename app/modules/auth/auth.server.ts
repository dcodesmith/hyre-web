import type { User } from "@prisma/client";
import { redirect } from "@remix-run/node";
import { Authenticator } from "remix-auth";
import { TOTPStrategy } from "remix-auth-totp";
import invariant from "tiny-invariant";
import logger from "~/lib/logger.server";
import { prisma } from "~/modules/db/db.server";
import { sendAuthEmail } from "~/modules/email/email.server";
import { RoleName, userHasRole } from "~/utils/client/misc";
import { sessionStorage } from "./session.server";
import { env } from "~/utils/server/env.server";
import { safeRedirect } from "~/utils/safe-redirect";

export const authenticator = new Authenticator<User>(sessionStorage, {
  sessionErrorKey: "my-error-key",
});

const totpStrategy = new TOTPStrategy(
  {
    secret: env.ENCRYPTION_SECRET || "NOT_A_STRONG_SECRET",
    sendTOTP: async ({ email, code, context }) => {
      const role = context?.role as RoleName;

      const user = await prisma.user.findUnique({
        where: { email },
        include: { roles: true },
      });

      if (user && !userHasRole(user, role)) {
        throw new Error("Did you sign up with a different role?");
      }

      logger.info(`OTP code: ${code}`);

      if (process.env.NODE_ENV === "development") {
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
        code,
        intent: user ? "login" : "registration",
      });
    },
    validateEmail: async () => true,
  },
  async ({ email, request }) => {
    const url = new URL(request.url);
    const redirectToUrl = url.searchParams.get("redirectTo");
    let role = url.searchParams.get("role");

    // If redirectTo contains a role parameter, use that, otherwise keep the role from URL params
    if (redirectToUrl) {
      const roleFromRedirectTo = new URL(redirectToUrl, "https://dummy.com").searchParams.get(
        "role",
      );
      if (roleFromRedirectTo) {
        role = roleFromRedirectTo;
      }
    }

    invariant(role, "role is required");

    let user = await prisma.user.findUnique({
      where: { email },
      include: {
        roles: { select: { name: true } },
      },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          roles: { connect: [{ name: role }] },
          hasOnboarded: role === "fleetOwner",
          ...(role === "fleetOwner" && { fleetOwnerStatus: "APPROVED" }),
        },
        include: { roles: true },
      });
    }

    return user;
  },
);

authenticator.use(totpStrategy);

/**
 * Utilities.
 */
async function getUserId(request: Request) {
  const user = await authenticator.isAuthenticated(request);
  return user?.id;
}

export async function requireSessionUser(
  request: Request,
  { redirectTo }: { redirectTo?: string | null } = {},
) {
  const sessionUser = await authenticator.isAuthenticated(request);

  if (!sessionUser) {
    if (!redirectTo) {
      throw redirect("/auth");
    }

    throw redirect(safeRedirect(redirectTo, "/logout"));
  }

  return sessionUser;
}

export async function requireUser(
  request: Request,
  { redirectTo }: { redirectTo?: string | null } = {},
) {
  try {
    const sessionUser = await authenticator.isAuthenticated(request);

    const user = sessionUser?.id
      ? await prisma.user.findUnique({
          where: { id: sessionUser.id },
          include: {
            roles: { select: { name: true } },
          },
        })
      : null;

    // If session exists but user doesn't exist in DB, clear the invalid session
    if (sessionUser && !user) {
      logger.warn(
        `Session exists for user ${sessionUser.id} but user not found in database. Clearing session.`,
      );
      throw redirect("/logout");
    }

    if (!user) {
      if (!redirectTo) {
        throw redirect("/auth");
      }
      throw redirect(safeRedirect(redirectTo, "/logout"));
    }

    return user;
  } catch (error) {
    // If there's any error with session validation, clear it and redirect to auth
    if (error instanceof Response) {
      throw error; // Re-throw redirect responses
    }

    logger.error("Error in requireUser:", error);
    throw redirect(safeRedirect(redirectTo, "/logout"));
  }
}

/**
 * Require admin user and redirect to admin login if not authenticated
 */
export async function requireAdminWithRedirect(request: Request) {
  const user = await requireUser(request, {
    redirectTo: `/admin/login?${new URLSearchParams({
      redirectTo: new URL(request.url).pathname,
    })}`,
  });

  if (!userHasRole(user, "admin")) {
    throw redirect("/admin/login");
  }

  return user;
}

/**
 * Gets the current user from the session without redirecting
 * Returns null if no user is logged in or if session is invalid
 */
export async function getSessionUser(request: Request) {
  try {
    const userId = await getUserId(request);
    if (!userId) return null;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          select: {
            name: true,
          },
        },
      },
    });

    // If session exists but user doesn't exist in DB, the session is stale
    if (userId && !user) {
      logger.warn(`Session exists for user ${userId} but user not found in database.`);
      return null;
    }

    return user;
  } catch (error) {
    logger.error("Error in getSessionUser:", error);
    return null;
  }
}

export async function requireUserWithRole(request: Request, role: string) {
  const user = await requireUser(request);

  const hasRole = user.roles.some((userRole) => userRole.name === role);
  if (!hasRole) {
    throw new Response("Unauthorized", { status: 403 });
  }

  return user;
}

/**
 * Require admin or staff user and redirect to admin login if not authenticated
 */
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
