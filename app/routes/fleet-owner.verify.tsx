import { parseWithZod } from "@conform-to/zod/v4";
import { ActionFunctionArgs, LoaderFunctionArgs, data, redirect } from "@remix-run/node";
import { useActionData, useLoaderData } from "@remix-run/react";
import { getSessionUser } from "~/modules/auth/auth.server";
import { commitSession, getSession } from "~/modules/auth/session.server";
import { validateCSRF } from "~/utils/csrf-action.server";
import { safeRedirect } from "~/utils/safe-redirect";
import logger from "~/lib/logger.server";
import { userHasRole } from "~/utils/shared/roles";
import {
  clearAuthSession,
  createAuthErrorResponse,
  createAuthRedirectResponse,
  ensureUserHasRole,
  getAuthContext,
  getDashboardUrlForRole,
  getLoginUrlForRole,
  signInWithOTP,
} from "~/utils/server/auth-helpers.server";
import { VerifyOTPForm } from "~/components/forms/VerifyOTPForm";
import { VerifySchema } from "~/schemas/otp.schema";

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

  const formData = await request.formData();

  // Validate OTP code using schema (single source of truth)
  const submission = parseWithZod(formData, {
    schema: VerifySchema,
  });

  if (submission.status !== "success") {
    return data(submission.reply(), { status: 400 });
  }

  const { code } = submission.value;

  try {
    const { userId, cookie } = await signInWithOTP(authEmail, code, request);

    // Ensure user has fleetOwner role (grants role if missing for new users)
    // This is safe because we've verified they came through the fleet-owner login flow
    // with the correct role stored in the session (authRole === "fleetOwner")
    await ensureUserHasRole(userId, "fleetOwner");

    // Clear auth session data
    clearAuthSession(session);

    // Redirect to fleet-owner dashboard
    const finalRedirect = redirectTo || getDashboardUrlForRole("fleetOwner");

    return createAuthRedirectResponse(finalRedirect, session, cookie);
  } catch (error) {
    logger.error("Error verifying OTP for fleet owner", { error, email: authEmail });
    return createAuthErrorResponse(error, session, "Invalid verification code");
  }
}

export default function FleetOwnerVerify() {
  const { authEmail, authError } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return <VerifyOTPForm authEmail={authEmail} authError={authError} actionData={actionData} />;
}
