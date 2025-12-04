import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod";
import { CogIcon } from "@heroicons/react/24/outline";
import { ActionFunctionArgs, LoaderFunctionArgs, data, redirect } from "@remix-run/node";
import { Outlet, useActionData, useLoaderData, useSearchParams } from "@remix-run/react";
import { z } from "zod";
import { Form } from "~/components/CSRFForm";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
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

export const LoginSchema = z.object({
  email: z
    .string({
      required_error: "Email is required.",
    })
    .trim()
    .max(60)
    .email("Email address is not valid."),
  referralCode: z
    .string()
    .length(8, "Referral code must be exactly 8 characters")
    .regex(/^[123456789ABCDEFGHJKLMNPQRSTUVWXYZ]+$/, "Invalid referral code format")
    .optional()
    .or(z.literal("")),
});

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getSessionUser(request);
  if (user) {
    throw redirect("/");
  }

  const cookie = await getSession(request.headers.get("Cookie"));
  const authEmail = cookie.get("auth:email");
  const authError = cookie.get("auth:error");

  // Clear auth:error after reading to prevent stale state
  if (authError) {
    cookie.unset("auth:error");
  }

  return data(
    { authEmail, authError },
    authError
      ? {
          headers: {
            "Set-Cookie": await commitSession(cookie),
          },
        }
      : undefined,
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
  const referralCodeFromUrl = url.searchParams.get("ref");

  const { email, referralCode } = submission.value;
  const role = "user" as const; // Customer login is always "user" role

  // Use referral code from form or URL parameter
  const finalReferralCodeRaw = referralCode ?? referralCodeFromUrl ?? "";
  const finalReferralCode = finalReferralCodeRaw.trim().toUpperCase() || undefined;

  try {
    // Check if user exists and validate role
    const existingUser = await prisma.user.findUnique({
      where: { email },
      include: { roles: true },
    });

    if (existingUser && !userHasRole(existingUser, role)) {
      return data({ error: "Did you sign up with a different role?" }, { status: 400 });
    }

    // Send OTP and redirect to verify page
    return sendOTPAndRedirect(request, email, role, redirectTo, finalReferralCode);
  } catch (error) {
    logger.error("Error sending OTP for user", { error });

    // For same-route failures, only return actionData.error
    // Don't set auth:error cookie to avoid duplication and stale state
    return data(
      { error: error instanceof Error ? error.message : "Failed to send verification code" },
      { status: 500 },
    );
  }
}

export default function Login() {
  const { authEmail, authError } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [searchParams] = useSearchParams();
  const isPending = useIsPending();

  const referralCodeFromUrl = searchParams.get("ref") || "";

  const [form, { email, referralCode }] = useForm({
    defaultValue: {
      email: authEmail || "",
      referralCode: referralCodeFromUrl,
    },
    constraint: getZodConstraint(LoginSchema),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: LoginSchema });
    },
    shouldValidate: "onSubmit",
    shouldRevalidate: "onInput",
  });

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Login to your account</CardTitle>
              <CardDescription>
                Enter your email below to login or create your account
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

                  {/* Referral Code Input - only show if not prefilled from URL */}
                  {!referralCodeFromUrl && (
                    <div className="space-y-1">
                      <label htmlFor={referralCode.id} className="text-sm font-medium">
                        Referral code (optional)
                      </label>
                      <Input
                        className={`bg-transparent ${
                          referralCode.errors
                            ? "border-destructive focus-visible:ring-destructive"
                            : ""
                        }`}
                        {...getInputProps(referralCode, { type: "text" })}
                        placeholder="XXXXXXXX"
                      />
                      {referralCode.errors && (
                        <div className="text-destructive text-sm">
                          {referralCode.errors.join(", ")}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Show referral info if code is from URL */}
                  {referralCodeFromUrl && (
                    <div className="text-sm text-muted-foreground p-3 bg-green-50 rounded-md border border-green-200">
                      🎉 You're signing up with referral code:{" "}
                      <span className="font-semibold">{referralCodeFromUrl}</span>
                      <input type="hidden" name="referralCode" value={referralCodeFromUrl} />
                    </div>
                  )}

                  {/* Prioritize actionData.error for same-route failures, fallback to authError for cross-route errors */}
                  {(actionData?.error || authError) && (
                    <span className="mb-2 text-sm text-destructive dark:text-destructive-foreground">
                      {actionData?.error ||
                        (typeof authError === "string" ? authError : "An error occurred")}
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
          <Outlet />
        </div>
      </div>
    </div>
  );
}
