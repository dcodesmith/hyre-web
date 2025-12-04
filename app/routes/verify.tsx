import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { ActionFunctionArgs, LoaderFunctionArgs, data, redirect } from "@remix-run/node";
import { useActionData, useLoaderData } from "@remix-run/react";
import { Form } from "~/components/CSRFForm";
import { Button } from "~/components/ui/button";
import { VerifySchema } from "~/schemas/otp.schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { getSessionUser } from "~/modules/auth/auth.server";
import type { User } from "@prisma/client";
import { commitSession, getSession } from "~/modules/auth/session.server";
import { validateCSRF } from "~/utils/csrf-action.server";
import { safeRedirect } from "~/utils/safe-redirect";
import logger from "~/lib/logger.server";
import { prisma } from "~/modules/db/db.server";
import {
  createReferralCodeForUser,
  handleReferralAttribution,
  validateReferralCode,
} from "~/services/referral.server";
import { userHasRole } from "~/utils/shared/roles";
import {
  clearAuthSession,
  createAuthErrorResponse,
  createAuthRedirectResponse,
  ensureUserHasRole,
  getAuthContext,
  redirectToLoginForRole,
  signInWithOTP,
} from "~/utils/server/auth-helpers.server";
import { useResendOTP } from "~/hooks/use-resend-otp";

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

async function handleReferralForNewUser(
  userId: string,
  authEmail: string,
  authReferralCode: string | null,
  request: Request,
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) return;

  // Deterministic check: user is new if createdAt equals updatedAt
  // (user hasn't been updated since creation)
  const isNewUser = user.createdAt.getTime() === user.updatedAt.getTime();
  if (!isNewUser) return;

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

    // Handle referral code for new users
    await handleReferralForNewUser(userId, authEmail, authReferralCode, request);

    // Ensure user has user role
    await ensureUserHasRole(userId, "user");

    // Clear auth session data
    clearAuthSession(session);

    // Redirect to home (customer route)
    const finalRedirect = redirectTo || "/";

    return createAuthRedirectResponse(finalRedirect, session, cookie);
  } catch (error) {
    logger.error("Error verifying OTP", { error, email: authEmail });
    return createAuthErrorResponse(error, session, "Invalid verification code");
  }
}

export default function Verify() {
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
