import { parseWithZod } from "@conform-to/zod/v4";
import { ActionFunctionArgs, LoaderFunctionArgs, data, redirect } from "@remix-run/node";
import { useActionData, useLoaderData } from "@remix-run/react";
import logger from "~/lib/logger.server";
import { getSessionUser } from "~/modules/auth/auth.server";
import { commitSession, getSession } from "~/modules/auth/session.server";
import { userHasRole } from "~/utils/shared/roles";
import { validateCSRF } from "~/utils/csrf-action.server";
import { safeRedirect } from "~/utils/safe-redirect";
import {
  clearAuthSession,
  createAuthErrorResponse,
  createAuthRedirectResponse,
  getAuthContext,
  getDashboardUrlForRole,
  getLoginUrlForRole,
  signInWithOTP,
  verifyUserHasRole,
} from "~/utils/server/auth-helpers.server";
import { VerifyOTPForm } from "~/components/forms/VerifyOTPForm";
import { VerifySchema } from "~/schemas/otp.schema";

export async function loader({ request }: LoaderFunctionArgs) {
  // Redirect to admin if already authenticated
  const url = new URL(request.url);
  const redirectTo = safeRedirect(url.searchParams.get("redirectTo"));

  const user = await getSessionUser(request);
  if (user && (userHasRole(user, "admin") || userHasRole(user, "staff"))) {
    throw redirect(redirectTo || "/admin");
  }

  const cookie = await getSession(request.headers.get("Cookie"));
  const authEmail = cookie.get("auth:email");
  const authError = cookie.get("auth:error");
  const authRole = cookie.get("auth:role");

  // Clear auth:error after reading to prevent stale state
  if (authError) {
    cookie.unset("auth:error");
  }

  // Security check: require authEmail
  if (!authEmail) {
    return redirect("/admin/login");
  }

  // Security check: require authRole to be explicitly set and valid
  if (!authRole || (authRole !== "admin" && authRole !== "staff")) {
    logger.warn("Admin verification loader accessed with missing or invalid role", {
      role: authRole,
    });
    return redirect("/admin/login");
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
  const redirectTo = safeRedirect(url.searchParams.get("redirectTo"));

  const { session, authEmail, authRole } = await getAuthContext(request);

  // Security check: require authEmail
  if (!authEmail) {
    logger.warn("Admin verification attempted without email in session");
    return redirect(getLoginUrlForRole("admin", redirectTo));
  }

  // Security check: require authRole to be explicitly set and valid
  if (!authRole || (authRole !== "admin" && authRole !== "staff")) {
    logger.warn("Admin verification attempted with missing or invalid role", {
      role: authRole,
    });
    return redirect(getLoginUrlForRole("admin", redirectTo));
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

  try {
    const { userId, cookie } = await signInWithOTP(authEmail, code, request);

    // Strictly verify user has admin or staff role (do NOT grant roles)
    // This prevents TOCTOU vulnerabilities and unauthorized role escalation
    await verifyUserHasRole(userId, authRole);

    // Clear auth session data
    clearAuthSession(session);

    // Redirect to admin dashboard
    const finalRedirect = redirectTo || getDashboardUrlForRole(authRole);

    return createAuthRedirectResponse(finalRedirect, session, cookie);
  } catch (error) {
    logger.error("Error verifying OTP for admin/staff", { error });
    return createAuthErrorResponse(error, session, "Invalid verification code");
  }
}

export default function AdminVerify() {
  const { authEmail, authError } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return <VerifyOTPForm authEmail={authEmail} authError={authError} actionData={actionData} />;
}
