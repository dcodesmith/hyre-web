import { parseWithZod } from "@conform-to/zod/v4";
import type { User } from "@prisma/client";
import {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  data,
  redirect,
  useActionData,
  useLoaderData,
} from "react-router";
import { createHash } from "node:crypto";
import { VerifyOTPForm } from "~/components/forms/VerifyOTPForm";
import { AuthSplitLayout } from "~/components/layout/AuthSplitLayout";
import logger from "~/lib/logger.server";
import { getSessionUser } from "~/modules/auth/auth.server";
import { commitSession, getSession } from "~/modules/auth/session.server";
import { prisma } from "~/modules/db/db.server";
import { VerifySchema } from "~/schemas/otp.schema";
import {
  createReferralCodeForUser,
  handleReferralAttribution,
  validateReferralCode,
} from "~/services/referral.server";
import { validateCSRF } from "~/utils/csrf-action.server";
import { safeRedirect } from "~/utils/safe-redirect";
import {
  clearAuthSession,
  createAuthErrorResponse,
  createAuthRedirectResponse,
  ensureUserHasRole,
  getAuthContext,
  isInvalidOtpError,
  isOtpRateLimitError,
  redirectToLoginForRole,
  signInWithOTP,
} from "~/utils/server/auth-helpers.server";
import {
  checkOtpVerificationGuard,
  clearOtpFailures,
  isTooManyAttemptsError,
  recordOtpFailure,
} from "~/utils/server/rate-limit.server";
import { userHasRole } from "~/utils/shared/roles";

function hashIdentifierForLogs(value: string | null | undefined) {
  return createHash("sha256")
    .update(value ?? "__NULLISH__")
    .digest("hex");
}

function redirectAuthenticatedUser(user: User & { roles: { name: string }[] }, redirectTo: string) {
  if (userHasRole(user, "user")) {
    throw redirect(redirectTo ? `/?redirectTo=${encodeURIComponent(redirectTo)}` : "/");
  }
  if (userHasRole(user, "fleetOwner")) {
    throw redirect("/fleet-owner");
  }
  if (userHasRole(user, "admin") || userHasRole(user, "staff")) {
    throw redirect("/admin");
  }
  throw redirect("/");
}

function redirectForInvalidStoredRole(storedRole: string | null) {
  if (!storedRole || storedRole === "user") {
    return null;
  }
  if (storedRole === "fleetOwner") {
    return redirect("/fleet-owner/login");
  }
  if (storedRole === "admin" || storedRole === "staff") {
    return redirect("/admin/login");
  }
  return redirect("/auth");
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const redirectTo = safeRedirect(url.searchParams.get("redirectTo"), "");

  const user = await getSessionUser(request);
  if (user) {
    redirectAuthenticatedUser(user, redirectTo);
  }

  const cookie = await getSession(request.headers.get("Cookie"));
  const authEmail = cookie.get("auth:email");
  const authError = cookie.get("auth:error");

  // Clear auth:error after reading to prevent stale state
  if (authError) {
    cookie.unset("auth:error");
  }

  const storedRole = cookie.get("auth:role");
  const roleRedirect = redirectForInvalidStoredRole(storedRole);
  if (roleRedirect) {
    return roleRedirect;
  }

  if (!authEmail) return redirect("/auth");

  return data(
    { authEmail, authError },
    {
      headers: {
        "Set-Cookie": await commitSession(cookie),
        "Cache-Control": "no-store",
      },
    },
  );
}

/**
 * Validate referral code and return whether attribution should proceed
 */
async function validateReferralCodeForAttribution(
  referralCode: string,
  email: string,
  userId: string,
): Promise<boolean> {
  try {
    const referrer = await validateReferralCode(referralCode, email);

    if (referrer) {
      return true;
    }

    logger.warn("Referral code validation returned null", {
      userId,
      referralCode,
    });

    return false;
  } catch (error) {
    // Log validation errors but don't break the flow
    logger.error("Referral code validation failed (non-fatal)", {
      userId,
      referralCode,
      error: error instanceof Error ? error.message : String(error),
    });

    return false;
  }
}

/**
 * Create referral code for user (best-effort, non-fatal).
 * Logs errors without throwing to avoid blocking the auth flow.
 */
async function createUserReferralCode(userId: string): Promise<void> {
  try {
    await createReferralCodeForUser(userId);
  } catch (error) {
    logger.error("Failed to generate referral code for user", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function runBestEffortOtpStateWrite(args: {
  operation: "clear" | "record";
  accountKey: string;
  subjectKey: string;
  write: () => Promise<void>;
}) {
  const { operation, accountKey, subjectKey, write } = args;
  try {
    await write();
  } catch (error) {
    const redactedAccountKeyHash = hashIdentifierForLogs(accountKey);
    const redactedSubjectKeyHash = hashIdentifierForLogs(subjectKey);
    logger.warn("Best-effort OTP state write failed", {
      operation,
      accountKeyHash: redactedAccountKeyHash,
      subjectKeyHash: redactedSubjectKeyHash,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function handleReferralForNewUser(
  userId: string,
  authEmail: string,
  authReferralCode: string | null,
  request: Request,
  authAcceptedTerms: boolean | undefined,
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) return;

  // Deterministic check: user is new if createdAt equals updatedAt
  // (user hasn't been updated since creation)
  const isNewUser = user.createdAt.getTime() === user.updatedAt.getTime();
  if (!isNewUser) return;

  // Save consent timestamps for new users who accepted terms
  if (authAcceptedTerms) {
    const now = new Date();
    await prisma.user.update({
      where: { id: userId },
      data: {
        termsAcceptedAt: now,
        privacyAcceptedAt: now,
      },
    });
  }

  await createUserReferralCode(userId);

  // Handle referral code validation and attribution if provided
  const trimmedReferralCode = authReferralCode?.trim();
  if (!trimmedReferralCode || trimmedReferralCode.length === 0) {
    return;
  }

  const shouldProceedWithAttribution = await validateReferralCodeForAttribution(
    trimmedReferralCode,
    authEmail,
    userId,
  );

  if (shouldProceedWithAttribution) {
    await handleReferralAttribution(userId, trimmedReferralCode, request);
  }
}

export async function action({ request }: ActionFunctionArgs) {
  await validateCSRF(request);

  const url = new URL(request.url);
  const redirectTo = safeRedirect(url.searchParams.get("redirectTo"), "");
  const referralCodeFromUrl = url.searchParams.get("ref");

  const {
    session,
    authEmail,
    authRole,
    authReferralCode: sessionReferralCode,
    authAcceptedTerms,
  } = await getAuthContext(request);
  const authReferralCode = sessionReferralCode || referralCodeFromUrl;

  // Security check: require authEmail
  if (!authEmail) {
    return redirect("/auth");
  }

  // Security check: require authRole to be explicitly set and valid
  // Allow undefined/null to default to "user" for customer verification, but log it
  // Reject any non-user roles
  if (authRole && authRole !== "user") {
    logger.warn("Attempted customer verification with invalid role", {
      email: authEmail,
      role: authRole,
    });
    return redirectToLoginForRole(authRole, redirectTo);
  }

  const otpGuard = await checkOtpVerificationGuard({ request, email: authEmail });
  if (!otpGuard.allowed) {
    return data(
      {
        error: otpGuard.message,
        isRateLimit: true,
        retryAfterSeconds: otpGuard.retryAfterSeconds,
      },
      {
        status: otpGuard.status ?? 429,
        headers: otpGuard.headers,
      },
    );
  }

  const formData = await request.formData();

  // Validate OTP code using schema (single source of truth)
  const submission = parseWithZod(formData, {
    schema: VerifySchema,
  });

  if (submission.status !== "success") {
    return submission.reply();
  }

  const { code } = submission.value;

  let signInResult: Awaited<ReturnType<typeof signInWithOTP>>;
  try {
    signInResult = await signInWithOTP(authEmail, code, request);
  } catch (error) {
    logger.error("Error verifying OTP", { error, email: authEmail });

    if (isTooManyAttemptsError(error) || isOtpRateLimitError(error)) {
      return data(
        {
          error: "Too many verification attempts. Please request a new code and try again later.",
          isRateLimit: true,
        },
        {
          status: 429,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }

    if (isInvalidOtpError(error)) {
      await runBestEffortOtpStateWrite({
        operation: "record",
        accountKey: otpGuard.accountKey,
        subjectKey: otpGuard.subjectKey,
        write: () =>
          recordOtpFailure({
            accountKey: otpGuard.accountKey,
            subjectKey: otpGuard.subjectKey,
          }),
      });
    }

    return createAuthErrorResponse(error, session, "Invalid verification code");
  }

  const { userId, cookies } = signInResult;
  try {
    await runBestEffortOtpStateWrite({
      operation: "clear",
      accountKey: otpGuard.accountKey,
      subjectKey: otpGuard.subjectKey,
      write: () =>
        clearOtpFailures({
          accountKey: otpGuard.accountKey,
          subjectKey: otpGuard.subjectKey,
        }),
    });

    // Handle referral code and consent for new users
    await handleReferralForNewUser(userId, authEmail, authReferralCode, request, authAcceptedTerms);

    // Ensure user has user role
    await ensureUserHasRole(userId, "user");

    // Clear auth session data
    clearAuthSession(session);

    // Redirect to home (customer route)
    const finalRedirect = redirectTo || "/";

    return createAuthRedirectResponse(finalRedirect, session, cookies);
  } catch (error) {
    logger.error("Post-OTP verification steps failed", {
      error,
      email: authEmail,
      userId,
    });
    return createAuthErrorResponse(error, session, "Unable to complete sign-in. Please try again.");
  }
}

export default function Verify() {
  const { authEmail, authError } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <AuthSplitLayout>
      <VerifyOTPForm authEmail={authEmail} authError={authError} actionData={actionData} />
    </AuthSplitLayout>
  );
}
