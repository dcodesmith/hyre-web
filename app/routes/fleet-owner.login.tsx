import { getFormProps, getInputProps, useForm, useInputControl } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { CogIcon } from "@heroicons/react/24/outline";
import { ActionFunctionArgs, LoaderFunctionArgs, data, redirect } from "@remix-run/node";
import { Link, useActionData, useLoaderData } from "@remix-run/react";
import { Form } from "~/components/CSRFForm";
import { LoginSchema } from "~/schemas/auth.schema";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import logger from "~/lib/logger.server";
import { useIsPending } from "~/lib/utils";
import { getSessionUser } from "~/modules/auth/auth.server";
import { commitSession, getSession } from "~/modules/auth/session.server";
import { prisma } from "~/modules/db/db.server";
import { userHasRole } from "~/utils/shared/roles";
import { validateCSRF } from "~/utils/csrf-action.server";
import { safeRedirect } from "~/utils/safe-redirect";
import { sendOTPAndRedirect } from "~/utils/server/auth-helpers.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getSessionUser(request);
  if (user) {
    // If already logged in as fleet owner, redirect to dashboard
    if (userHasRole(user, "fleetOwner")) {
      throw redirect("/fleet-owner");
    }
    // Otherwise redirect to home
    throw redirect("/");
  }

  const cookie = await getSession(request.headers.get("Cookie"));
  const authEmail = cookie.get("auth:email");
  const authError = cookie.get("auth:error");

  if (authError) {
    cookie.unset("auth:error");
  }

  return data(
    { authEmail, authError },
    authError ? { headers: { "Set-Cookie": await commitSession(cookie) } } : undefined,
  );
}

export async function action({ request }: ActionFunctionArgs) {
  await validateCSRF(request);

  const formData = await request.clone().formData();
  const url = new URL(request.url);

  // Validate the form data
  const submission = parseWithZod(formData, { schema: LoginSchema });
  if (submission.status !== "success") {
    return data(submission.reply(), { status: 400 });
  }

  const redirectTo = safeRedirect(url.searchParams.get("redirectTo"), "");
  const { email, acceptTerms } = submission.value;
  const role = "fleetOwner" as const;

  try {
    // Check if user exists and validate role
    const existingUser = await prisma.user.findUnique({
      where: { email },
      include: { roles: true },
    });

    if (existingUser && !userHasRole(existingUser, role)) {
      // Log security event without revealing information to the user
      logger.warn("User attempted fleet owner login with wrong role", {
        email,
        attemptedRole: role,
        actualRoles: existingUser.roles.map((r) => r.name),
      });
      return data(
        { error: "We couldn't start the login process. Please check your details and try again." },
        { status: 400 },
      );
    }

    // Send OTP and redirect to verify page
    // Pass acceptTerms for consent tracking
    return sendOTPAndRedirect(request, email, role, redirectTo, undefined, acceptTerms);
  } catch (error) {
    logger.error("Error sending OTP for fleet owner", { error });

    // For same-route failures, only return actionData.error
    // Don't set auth:error cookie to avoid duplication and stale state
    return data(
      { error: error instanceof Error ? error.message : "Failed to send verification code" },
      { status: 500 },
    );
  }
}

export default function FleetOwnerLogin() {
  const { authEmail, authError } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const isPending = useIsPending();

  let errorMessage: string | undefined;
  if (actionData?.error) {
    errorMessage = typeof actionData.error === "string" ? actionData.error : "An error occurred";
  } else if (typeof authError === "string") {
    errorMessage = authError;
  } else if (authError) {
    errorMessage = "An error occurred";
  }

  const [form, { email, acceptTerms }] = useForm({
    defaultValue: {
      email: authEmail || "",
    },
    constraint: getZodConstraint(LoginSchema),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: LoginSchema });
    },
    shouldValidate: "onSubmit",
    shouldRevalidate: "onInput",
  });

  const acceptTermsControl = useInputControl(acceptTerms);

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Fleet Owner Login</CardTitle>
              <CardDescription>
                Enter your email below to login to your fleet owner account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form method="post" {...getFormProps(form)}>
                <div className="flex flex-col gap-4">
                  <div className="space-y-1">
                    <label htmlFor={email.id} className="text-sm font-medium">
                      Email
                    </label>
                    <Input
                      className={`bg-transparent ${
                        email.errors ? "border-destructive focus-visible:ring-destructive" : ""
                      }`}
                      {...getInputProps(email, { type: "email" })}
                      placeholder="m@example.com"
                    />
                    {email.errors && (
                      <div className="text-destructive text-sm">{email.errors.join(", ")}</div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor={acceptTerms.id}
                      className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer"
                    >
                      <Checkbox
                        id={acceptTerms.id}
                        name={acceptTerms.name}
                        className="shrink-0"
                        checked={acceptTermsControl.value === "on"}
                        onCheckedChange={(checked) => {
                          acceptTermsControl.change(checked ? "on" : "");
                        }}
                        onBlur={acceptTermsControl.blur}
                      />
                      <span>
                        I agree to the{" "}
                        <Link to="/terms" className="text-primary hover:underline" target="_blank">
                          Terms of Service
                        </Link>{" "}
                        and{" "}
                        <Link
                          to="/privacy"
                          className="text-primary hover:underline"
                          target="_blank"
                        >
                          Privacy Policy
                        </Link>
                      </span>
                    </label>
                    {acceptTerms.errors && (
                      <div className="text-destructive text-sm">{acceptTerms.errors.join(", ")}</div>
                    )}
                  </div>

                  {errorMessage && (
                    <span className="mb-2 text-sm text-destructive dark:text-destructive-foreground">
                      {errorMessage}
                    </span>
                  )}

                  <Button type="submit" className="w-full" disabled={isPending}>
                    {isPending ? (
                      <CogIcon className="h-5 w-5 animate-spin" />
                    ) : (
                      "Continue with Email"
                    )}
                  </Button>
                </div>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
