import { ActionFunctionArgs, LoaderFunctionArgs, data, redirect } from "@remix-run/node";
import { useActionData, useLoaderData } from "@remix-run/react";
import { Form } from "~/components/CSRFForm";
import { Button } from "~/components/ui/button";
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
  resendOTP,
  signInWithOTP,
  verifyUserHasRole,
} from "~/utils/server/auth-helpers.server";

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
  const codeValue = formData.get("code");
  const code = typeof codeValue === "string" ? codeValue : undefined;

  // Handle "Request New Code" - resend OTP
  if (!code) {
    return resendOTP(request, session, authEmail);
  }

  if (code.length < 6) {
    return data({ error: "Code must be at least 6 characters" }, { status: 400 });
  }

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
  const actionData = useActionData<typeof action>();
  const { authError } = useLoaderData<typeof loader>();

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md space-y-8 p-6">
        <div>
          <h2 className="text-center text-3xl font-bold">Enter Verification Code</h2>
          <p className="text-center text-gray-600 mt-2">
            Check your email for the verification code
          </p>
        </div>
        <Form method="post" className="space-y-6">
          <div>
            <label htmlFor="code" className="block text-sm font-medium mb-2">
              Verification Code
            </label>
            <input
              type="text"
              name="code"
              id="code"
              className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              autoComplete="one-time-code"
              placeholder="Enter 6-digit code"
            />
          </div>
          <Button type="submit" className="w-full">
            Verify
          </Button>

          {/* Prioritize actionData.error for same-route failures, fallback to authError for cross-route errors */}
          {((actionData && "error" in actionData && actionData.error) || authError) && (
            <div className="text-red-500 text-sm text-center">
              {(actionData && "error" in actionData ? actionData.error : null) ||
                (typeof authError === "string" ? authError : authError?.message)}
            </div>
          )}
        </Form>

        <Form method="post" className="mt-4 space-y-2">
          <p className="text-center text-sm font-normal text-primary/60">
            Did not receive the code?
          </p>
          <Button type="submit" variant="ghost" className="w-full hover:bg-transparent">
            Request New Code
          </Button>
        </Form>
      </div>
    </div>
  );
}
