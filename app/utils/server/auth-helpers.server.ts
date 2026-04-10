import { data, redirect } from "react-router";
import logger from "~/lib/logger.server";
import { auth } from "~/modules/auth/auth.server";
import { commitSession, getSession } from "~/modules/auth/session.server";
import { normalizeEmail } from "~/utils/email-validation";
import { prisma } from "~/modules/db/db.server";
import { userHasRole, type RoleName } from "~/utils/shared/roles";

export type OtpSignInErrorKind = "invalid_otp" | "too_many_attempts" | "upstream_error";

export class OtpSignInError extends Error {
  readonly status: number;
  readonly kind: OtpSignInErrorKind;
  readonly details: unknown;

  constructor(args: {
    message: string;
    status: number;
    kind: OtpSignInErrorKind;
    details?: unknown;
  }) {
    super(args.message);
    this.name = "OtpSignInError";
    this.status = args.status;
    this.kind = args.kind;
    this.details = args.details;
  }
}

function extractOtpErrorCode(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;

  const value = payload as Record<string, unknown>;
  const directCode = value.code;
  if (typeof directCode === "string" && directCode.length > 0) {
    return directCode.toLowerCase();
  }

  const nestedError = value.error;
  if (nestedError && typeof nestedError === "object") {
    const nestedCode = (nestedError as Record<string, unknown>).code;
    if (typeof nestedCode === "string" && nestedCode.length > 0) {
      return nestedCode.toLowerCase();
    }
  }

  return undefined;
}

function classifyOtpSignInError(args: {
  status: number;
  message: string;
  code?: string;
}): OtpSignInErrorKind {
  const { status, message, code } = args;
  const normalizedMessage = message.toLowerCase();
  const normalizedCode = code?.toLowerCase() ?? "";

  if (status >= 500) {
    return "upstream_error";
  }

  if (status === 429 || normalizedMessage.includes("too many attempts")) {
    return "too_many_attempts";
  }

  if (
    status === 401 ||
    normalizedCode.includes("invalid_code") ||
    normalizedCode.includes("otp") ||
    normalizedCode.includes("verification") ||
    normalizedMessage.includes("invalid") ||
    normalizedMessage.includes("incorrect") ||
    normalizedMessage.includes("expired")
  ) {
    return "invalid_otp";
  }

  return "upstream_error";
}

export function isInvalidOtpError(error: unknown): boolean {
  if (error instanceof OtpSignInError) {
    return error.kind === "invalid_otp";
  }

  if (!error || typeof error !== "object") return false;
  const maybeStatus = (error as { status?: unknown }).status;
  return maybeStatus === 401;
}

/**
 * Returns true when the error indicates a rate limit from Better-auth (request rate
 * limit 429 or allowedAttempts exceeded). Use with isTooManyAttemptsError to handle
 * both Better-auth and custom rate limit responses.
 */
export function isOtpRateLimitError(error: unknown): boolean {
  if (error instanceof OtpSignInError) {
    return error.kind === "too_many_attempts";
  }
  if (!error || typeof error !== "object") return false;
  const maybeStatus = (error as { status?: unknown }).status;
  return maybeStatus === 429;
}

function resolveErrorStatus(error: unknown, fallbackStatus: number) {
  if (!error || typeof error !== "object") return fallbackStatus;
  const maybeStatus = (error as { status?: unknown }).status;
  return typeof maybeStatus === "number" ? maybeStatus : fallbackStatus;
}

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
 * Sign in with OTP and extract session cookie
 */
export async function signInWithOTP(email: string, otp: string, request: Request) {
  // Callers typically pass a pre-normalized email from the session (set by
  // sendOTPAndRedirect), but we normalize again as a safety net since this
  // function is a public export and normalizeEmail is idempotent.
  const normalizedEmail = normalizeEmail(email);
  let signInResponse: Response;
  try {
    signInResponse = await auth.api.signInEmailOTP({
      body: {
        email: normalizedEmail,
        otp,
      },
      headers: request.headers,
      asResponse: true,
    });
  } catch (error) {
    throw new OtpSignInError({
      message: error instanceof Error ? error.message : "Failed to sign in",
      status: 502,
      kind: "upstream_error",
      details: error,
    });
  }

  const signInData = await signInResponse.json().catch(() => ({}));

  if (!signInResponse.ok) {
    const message =
      typeof signInData?.message === "string" && signInData.message.length > 0
        ? signInData.message
        : "Failed to sign in";
    const code = extractOtpErrorCode(signInData);
    const kind = classifyOtpSignInError({
      status: signInResponse.status,
      message,
      code,
    });

    throw new OtpSignInError({
      message,
      status: signInResponse.status,
      kind,
      details: signInData,
    });
  }

  if (!signInData?.user?.id) {
    throw new OtpSignInError({
      message: "Failed to sign in",
      status: 502,
      kind: "upstream_error",
      details: signInData,
    });
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
  const errorMessage = error instanceof Error && error.message ? error.message : defaultMessage;
  const status = resolveErrorStatus(error, 401);

  // Detect "too many attempts" error and provide helpful guidance
  const isTooManyAttempts =
    errorMessage.toLowerCase().includes("too many attempts") ||
    errorMessage.toLowerCase().includes("maximum attempts");

  const userMessage = isTooManyAttempts
    ? "You've used all verification attempts for this code. Please request a new code to continue."
    : errorMessage;

  return data(
    { error: userMessage },
    {
      status,
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
  session.unset("auth:acceptedTerms");
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
    authAcceptedTerms: session.get("auth:acceptedTerms") as boolean | undefined,
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
  acceptedTerms?: boolean,
) {
  const session = await getSession(request.headers.get("Cookie"));
  session.set("auth:email", email);
  session.set("auth:role", role);
  if (referralCode) {
    session.set("auth:referralCode", referralCode);
  }
  if (acceptedTerms) {
    session.set("auth:acceptedTerms", true);
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
  acceptedTerms?: boolean,
) {
  const normalizedEmail = normalizeEmail(email);

  try {
    await auth.api.sendVerificationOTP({
      body: {
        email: normalizedEmail,
        type: "sign-in",
      },
      headers: request.headers,
    });
  } catch (error) {
    logger.error("Failed to send OTP", { error });
    throw new Error("Failed to send verification code. Please try again.");
  }

  const session = await storeAuthContext(request, normalizedEmail, role, referralCode, acceptedTerms);

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
