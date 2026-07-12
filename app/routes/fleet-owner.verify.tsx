import { parseWithZod } from "@conform-to/zod/v4";
import {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  data,
  redirect,
  useActionData,
  useLoaderData,
} from "react-router";
import { VerifyOTPForm } from "~/components/forms/VerifyOTPForm";
import { AuthSplitLayout } from "~/components/layout/AuthSplitLayout";
import logger from "~/lib/logger.server";
import { getSessionUser } from "~/modules/auth/auth.server";
import { commitSession, getSession } from "~/modules/auth/session.server";
import { VerifySchema } from "~/schemas/otp.schema";
import { validateCSRF } from "~/utils/csrf-action.server";
import { safeRedirect } from "~/utils/safe-redirect";
import {
  clearAuthSession,
  createAuthErrorResponse,
  createAuthRedirectResponse,
  ensureUserHasRole,
  getAuthContext,
  getDashboardUrlForRole,
  getLoginUrlForRole,
  isInvalidOtpError,
  isOtpRateLimitError,
  signInWithOTP,
} from "~/utils/server/auth-helpers.server";
import {
  checkOtpVerificationGuard,
  clearOtpFailures,
  isTooManyAttemptsError,
  recordOtpFailure,
} from "~/utils/server/rate-limit.server";
import { userHasRole } from "~/utils/shared/roles";

function hashIdentifierForLogs(value: string) {
  let hash = 5381;
  for (const char of value) {
    hash = (hash * 33) ^ (char.codePointAt(0) ?? 0);
  }
  return `h${(hash >>> 0).toString(16)}`;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const redirectTo = safeRedirect(url.searchParams.get("redirectTo"), "");

  // Check if already authenticated
  const user = await getSessionUser(request);
  if (user) {
    // Verify they have fleetOwner role
    if (userHasRole(user, "fleetOwner")) {
      throw redirect(redirectTo || "/fleet-owner");
    }
    // If not fleetOwner, redirect to home
    throw redirect("/");
  }

  const cookie = await getSession(request.headers.get("Cookie"));
  const authEmail = cookie.get("auth:email");
  const authError = cookie.get("auth:error");

  // Clear auth:error after reading to prevent stale state
  if (authError) {
    cookie.unset("auth:error");
  }

  // Security check: require authEmail
  if (!authEmail) {
    return redirect("/fleet-owner/login");
  }

  // Security check: require authRole to be explicitly set and valid
  const storedRole = cookie.get("auth:role");
  if (!storedRole || storedRole !== "fleetOwner") {
    logger.warn("Fleet-owner verification loader accessed with missing or invalid role", {
      email: authEmail,
      role: storedRole,
    });
    return redirect("/fleet-owner/login");
  }

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

export async function action({ request }: ActionFunctionArgs) {
  await validateCSRF(request);

  const url = new URL(request.url);
  const redirectTo = safeRedirect(url.searchParams.get("redirectTo"), "");

  const { session, authEmail, authRole } = await getAuthContext(request);

  // Security check: require authEmail
  if (!authEmail) {
    logger.warn("Fleet-owner verification attempted without email in session");
    return redirect(getLoginUrlForRole("fleetOwner", redirectTo));
  }

  // Security check: require authRole to be explicitly set and valid
  if (!authRole || authRole !== "fleetOwner") {
    logger.warn("Fleet-owner verification attempted with missing or invalid role", {
      email: authEmail,
      role: authRole,
    });
    return redirect(getLoginUrlForRole("fleetOwner", redirectTo));
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
    return data(submission.reply(), { status: 400 });
  }

  const { code } = submission.value;

  let signInResult: Awaited<ReturnType<typeof signInWithOTP>>;
  try {
    signInResult = await signInWithOTP(authEmail, code, request);
  } catch (error) {
    const redactedAuthEmail = hashIdentifierForLogs(authEmail);
    logger.error("Error verifying OTP for fleet owner", {
      error,
      redactedAuthEmail,
    });

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
      await recordOtpFailure({
        accountKey: otpGuard.accountKey,
        subjectKey: otpGuard.subjectKey,
      });
    }

    return createAuthErrorResponse(error, session, "Invalid verification code");
  }

  const { userId, cookies } = signInResult;
  try {
    await clearOtpFailures({
      accountKey: otpGuard.accountKey,
      subjectKey: otpGuard.subjectKey,
    });

    // Ensure user has fleetOwner role (grants role if missing for new users)
    // This is safe because we've verified they came through the fleet-owner login flow
    // with the correct role stored in the session (authRole === "fleetOwner")
    await ensureUserHasRole(userId, "fleetOwner");

    // Clear auth session data
    clearAuthSession(session);

    // Redirect to fleet-owner dashboard
    const finalRedirect = redirectTo || getDashboardUrlForRole("fleetOwner");

    return createAuthRedirectResponse(finalRedirect, session, cookies);
  } catch (error) {
    const redactedAuthEmail = hashIdentifierForLogs(authEmail);
    const redactedAccountKey = hashIdentifierForLogs(otpGuard.accountKey);
    const redactedSubjectKey = hashIdentifierForLogs(otpGuard.subjectKey);
    logger.error("Post-OTP fleet-owner verification step failed", {
      error,
      redactedAuthEmail,
      redactedAccountKey,
      redactedSubjectKey,
    });
    return createAuthErrorResponse(error, session, "Unable to complete sign-in. Please try again.");
  }
}

export default function FleetOwnerVerify() {
  const { authEmail, authError } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <AuthSplitLayout>
      <VerifyOTPForm authEmail={authEmail} authError={authError} actionData={actionData} />
    </AuthSplitLayout>
  );
}
