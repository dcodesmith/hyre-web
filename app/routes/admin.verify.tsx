import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod";
import { ActionFunctionArgs, LoaderFunctionArgs, data, redirect } from "@remix-run/node";
import { useActionData, useLoaderData } from "@remix-run/react";
import { Form } from "~/components/CSRFForm";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import logger from "~/lib/logger.server";
import { getSessionUser } from "~/modules/auth/auth.server";
import { commitSession, getSession } from "~/modules/auth/session.server";
import { userHasRole } from "~/utils/shared/roles";
import { validateCSRF } from "~/utils/csrf-action.server";
import { safeRedirect } from "~/utils/safe-redirect";
import { useResendOTP } from "~/hooks/use-resend-otp";
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

export const VerifySchema = z.object({
  code: z
    .string({ required_error: "Code is required." })
    .regex(/^\d{6}$/, "Code must be exactly 6 digits."),
});

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
  const { onResendOTP, isResending, hasResentSuccessfully } = useResendOTP(authEmail, actionData);

  const [codeForm, { code }] = useForm({
    lastResult: actionData && "status" in actionData ? actionData : null,
    constraint: getZodConstraint(VerifySchema),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: VerifySchema });
    },
  });

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-xs">
        <Card>
          <CardHeader>
            <CardTitle>Enter verification code</CardTitle>
            <CardDescription>
              We sent a 6-digit code to {authEmail ?? "your email"}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form method="post" {...getFormProps(codeForm)}>
              <div className="flex flex-col gap-4">
                <div className="space-y-2">
                  <label htmlFor={code.id} className="text-sm font-medium">
                    Verification code
                  </label>
                  <Input
                    maxLength={6}
                    required
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="000000"
                    className={`bg-transparent ${
                      code.errors ? "border-destructive focus-visible:ring-destructive" : ""
                    }`}
                    {...getInputProps(code, { type: "text" })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter the 6-digit code sent to your email.
                  </p>
                </div>

                <div className="flex flex-col">
                  {code.errors && (
                    <span className="mb-2 text-sm text-destructive dark:text-destructive-foreground">
                      {code.errors.join(" ")}
                    </span>
                  )}
                  {/* Show authError for backend OTP mismatches (from cross-route or backend errors) */}
                  {/* Hide errors after successful resend to prevent contradictory feedback */}
                  {!hasResentSuccessfully && authError && (
                    <span className="mb-2 text-sm text-destructive dark:text-destructive-foreground">
                      {typeof authError === "string" ? authError : authError?.message}
                    </span>
                  )}
                </div>

                <Button type="submit" className="w-full">
                  Verify
                </Button>
              </div>
            </Form>

            <div className="mt-4 space-y-2">
              <p className="text-center text-sm font-normal text-primary/60">
                Did not receive the code?
              </p>
              <Button
                type="button"
                variant="ghost"
                className="w-full hover:bg-transparent"
                onClick={onResendOTP}
                disabled={isResending}
              >
                {isResending ? "Sending..." : "Request New Code"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
