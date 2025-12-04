import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod";
import { ActionFunctionArgs, LoaderFunctionArgs, data, redirect } from "@remix-run/node";
import { useActionData, useLoaderData } from "@remix-run/react";
import { Form } from "~/components/CSRFForm";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
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
  getAuthContext,
  getDashboardUrlForRole,
  getLoginUrlForRole,
  resendOTP,
  signInWithOTP,
  verifyUserHasRole,
} from "~/utils/server/auth-helpers.server";

export const VerifySchema = z.object({
  code: z
    .string({
      required_error: "Code is required.",
    })
    .length(6, "Code must be exactly 6 characters."),
});

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
  const intent = formData.get("intent");

  // Handle "Request New Code" - resend OTP
  if (intent === "resend") {
    return resendOTP(request, session, authEmail);
  }

  // Validate OTP code using schema (single source of truth)
  const submission = parseWithZod(formData, {
    schema: VerifySchema,
  });

  if (submission.status !== "success") {
    const codeErrors = submission.error?.code;
    const errorMessage =
      Array.isArray(codeErrors) && codeErrors.length > 0
        ? codeErrors[0]
        : "Invalid verification code.";
    return data(
      {
        error: errorMessage,
      },
      { status: 400 },
    );
  }

  const { code } = submission.value;

  try {
    const { userId, cookie } = await signInWithOTP(authEmail, code, request);

    // Strictly verify user has fleetOwner role (do NOT grant roles)
    // This prevents TOCTOU vulnerabilities and unauthorized role escalation
    await verifyUserHasRole(userId, "fleetOwner");

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

  const [codeForm, { code }] = useForm({
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
              <input type="hidden" name="intent" value="verify" />
              <div className="flex flex-col gap-4">
                <div className="space-y-2">
                  <label htmlFor={code.id} className="text-sm font-medium">
                    Verification code
                  </label>
                  <Input
                    maxLength={6}
                    required
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
                  {/* Prioritize actionData.error for same-route failures, fallback to authError for cross-route errors */}
                  {((actionData && "error" in actionData && actionData.error) || authError) && (
                    <span className="mb-2 text-sm text-destructive dark:text-destructive-foreground">
                      {(actionData && "error" in actionData ? actionData.error : null) ||
                        (typeof authError === "string" ? authError : authError?.message)}
                    </span>
                  )}
                </div>

                <Button type="submit" className="w-full">
                  Verify
                </Button>
              </div>
            </Form>

            <Form method="post" className="mt-4 space-y-2">
              <input type="hidden" name="intent" value="resend" />
              <p className="text-center text-sm font-normal text-primary/60">
                Did not receive the code?
              </p>
              <Button type="submit" variant="ghost" className="w-full hover:bg-transparent">
                Request New Code
              </Button>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
