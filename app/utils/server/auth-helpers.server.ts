import { data, redirect } from "@remix-run/node";
import logger from "~/lib/logger.server";
import { auth } from "~/modules/auth/auth.server";
import { commitSession, getSession } from "~/modules/auth/session.server";
import { prisma } from "~/modules/db/db.server";
import { userHasRole, type RoleName } from "~/utils/shared/roles";

/**
 * Role-based route configuration
 */
export const ROLE_ROUTES = {
  user: {
    login: "/auth",
    verify: "/verify",
    dashboard: "/",
  },
  fleetOwner: {
    login: "/fleet-owner/login",
    verify: "/fleet-owner/verify",
    dashboard: "/fleet-owner",
  },
  admin: {
    login: "/admin/login",
    verify: "/admin/verify",
    dashboard: "/admin",
  },
  staff: {
    login: "/admin/login",
    verify: "/admin/verify",
    dashboard: "/admin",
  },
  chauffeur: {
    login: "/auth",
    verify: "/verify",
    dashboard: "/",
  },
} as const satisfies Record<RoleName, { login: string; verify: string; dashboard: string }>;

/**
 * Get the login URL for a given role
 */
export function getLoginUrlForRole(role: RoleName, redirectTo?: string | null): string {
  const route = ROLE_ROUTES[role];
  const baseRedirectTo = redirectTo || route.dashboard;
  return `${route.login}?redirectTo=${encodeURIComponent(baseRedirectTo)}`;
}

/**
 * Get the verify URL for a given role
 */
export function getVerifyUrlForRole(role: RoleName, redirectTo?: string | null): string {
  const route = ROLE_ROUTES[role];
  const params = new URLSearchParams();

  if (redirectTo) {
    params.set("redirectTo", redirectTo);
  }

  const queryString = params.toString();
  return queryString ? `${route.verify}?${queryString}` : route.verify;
}

/**
 * Get the dashboard URL for a given role
 */
export function getDashboardUrlForRole(role: RoleName): string {
  return ROLE_ROUTES[role].dashboard;
}

/**
 * Redirect to the appropriate login page based on role
 */
export function redirectToLoginForRole(role: RoleName | null, redirectTo?: string | null) {
  if (role === "fleetOwner") {
    return redirect(getLoginUrlForRole("fleetOwner", redirectTo));
  }

  if (role === "admin" || role === "staff") {
    return redirect(getLoginUrlForRole("admin", redirectTo));
  }

  return redirect(getLoginUrlForRole("user", redirectTo));
}

/**
 * Resend OTP code
 */
export async function resendOTP(
  request: Request,
  session: Awaited<ReturnType<typeof getSession>>,
  email: string,
) {
  try {
    await auth.api.sendVerificationOTP({
      body: {
        email,
        type: "sign-in",
      },
      headers: request.headers,
    });
    // Clear any existing auth:error when resending succeeds
    session.unset("auth:error");
    return data(
      { message: "New code sent" },
      {
        headers: {
          "Set-Cookie": await commitSession(session),
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    logger.error("Error resending OTP", { error });
    // For same-route failures, only return actionData.error
    // Don't set auth:error cookie to avoid duplication and stale state
    return data(
      { error: "Failed to resend code" },
      {
        status: 500,
        headers: {
          "Set-Cookie": await commitSession(session),
          "Cache-Control": "no-store",
        },
      },
    );
  }
}

/**
 * Sign in with OTP and extract session cookie
 */
export async function signInWithOTP(email: string, otp: string, request: Request) {
  const signInResponse = await auth.api.signInEmailOTP({
    body: {
      email,
      otp,
    },
    headers: request.headers,
    asResponse: true,
  });

  const signInData = await signInResponse.json().catch(() => ({}));

  if (!signInResponse.ok) {
    throw new Error(signInData.message || "Failed to sign in");
  }

  if (!signInData?.user?.id) {
    throw new Error("Failed to sign in");
  }

  const cookie = signInResponse.headers.get("Set-Cookie");

  return {
    userId: signInData.user.id,
    cookie,
  };
}

/**
 * Create redirect response with session cookies
 */
export async function createAuthRedirectResponse(
  redirectTo: string,
  session: Awaited<ReturnType<typeof getSession>>,
  cookie?: string | null,
) {
  const headers = new Headers();
  headers.set("Set-Cookie", await commitSession(session));
  headers.set("Cache-Control", "no-store");

  if (cookie) {
    headers.append("Set-Cookie", cookie);
  }

  return redirect(redirectTo, { headers });
}

/**
 * Create error response for same-route failures
 * Only returns actionData.error, doesn't set auth:error cookie
 * to avoid duplication and stale state
 */
export async function createAuthErrorResponse(
  error: unknown,
  session: Awaited<ReturnType<typeof getSession>>,
  defaultMessage = "An error occurred",
) {
  const errorMessage = error instanceof Error ? error.message : defaultMessage;

  return data(
    { error: errorMessage },
    {
      status: 401,
      headers: {
        "Set-Cookie": await commitSession(session),
        "Cache-Control": "no-store",
      },
    },
  );
}

/**
 * Clear auth session data
 */
export function clearAuthSession(session: Awaited<ReturnType<typeof getSession>>) {
  session.unset("auth:email");
  session.unset("auth:role");
  session.unset("auth:referralCode");
  session.unset("auth:error");
}

/**
 * Get auth context from session
 */
export async function getAuthContext(request: Request) {
  const session = await getSession(request.headers.get("Cookie"));
  return {
    session,
    authEmail: session.get("auth:email") as string | undefined,
    authRole: session.get("auth:role") as RoleName | undefined,
    authReferralCode: session.get("auth:referralCode") as string | undefined,
    authError: session.get("auth:error") as string | Error | undefined,
  };
}

/**
 * Store auth context in session
 */
export async function storeAuthContext(
  request: Request,
  email: string,
  role: RoleName,
  referralCode?: string | null,
) {
  const session = await getSession(request.headers.get("Cookie"));
  session.set("auth:email", email);
  session.set("auth:role", role);
  if (referralCode) {
    session.set("auth:referralCode", referralCode);
  }
  session.unset("auth:error");
  return session;
}

/**
 * Send OTP and store auth context, then redirect to verify page
 */
export async function sendOTPAndRedirect(
  request: Request,
  email: string,
  role: RoleName,
  redirectTo?: string | null,
  referralCode?: string | null,
) {
  try {
    // Send OTP via better-auth
    await auth.api.sendVerificationOTP({
      body: {
        email,
        type: "sign-in",
      },
      headers: request.headers,
    });
  } catch (error) {
    logger.error("Failed to send OTP", { error });
    throw new Error("Failed to send verification code. Please try again.");
  }

  // Store context in session
  const session = await storeAuthContext(request, email, role, referralCode);

  // Build verify URL
  const route = ROLE_ROUTES[role];
  const params = new URLSearchParams();

  if (redirectTo) {
    params.set("redirectTo", redirectTo);
  }

  if (referralCode && role === "user") {
    params.set("ref", referralCode);
  }

  const verifyUrl = `${route.verify}?${params.toString()}`;

  return redirect(verifyUrl, {
    headers: {
      "Set-Cookie": await commitSession(session),
    },
  });
}

/**
 * Verify user has a specific role without granting it
 * Throws an error if the user doesn't have the role
 * This is used for security-critical paths like admin/staff verification
 */
export async function verifyUserHasRole(userId: string, roleName: RoleName) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { roles: true },
  });

  if (!user) {
    throw new Error("User not found after sign-in");
  }

  const hasRole = userHasRole(user, roleName);

  if (!hasRole) {
    throw new Error(`User does not have required role: ${roleName}`);
  }

  return user;
}

/**
 * Ensure user has a specific role, assigning it if missing
 */
export async function ensureUserHasRole(userId: string, roleName: RoleName) {
  let user = await prisma.user.findUnique({
    where: { id: userId },
    include: { roles: true },
  });

  if (!user) {
    throw new Error("User not found after sign-in");
  }

  const hasRole = userHasRole(user, roleName);

  if (!hasRole) {
    user = await prisma.user.update({
      where: { id: userId },
      data: {
        roles: {
          connect: [{ name: roleName }],
        },
      },
      include: { roles: true },
    });
  }

  return user;
}
