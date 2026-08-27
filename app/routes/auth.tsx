import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { data, Form, Link, redirect, useNavigation, useSearchParams } from "react-router";
import { ApiRequestError } from "~/api/api.server";
import { isSecureAuthCookie, sendSignInOtp } from "~/api/auth/auth.server";
import { authResponseHeaders } from "~/api/auth/cookie-relay.server";
import { authClientErrorMessage, authClientErrorStatus } from "~/api/auth/errors";
import { HTTP_STATUS } from "~/api/http-status";
import { AuthCheckbox, AuthSubmitButton } from "~/auth/auth-form-primitives";
import { loginFormSchema, validReferralCode } from "~/auth/auth-form-schema";
import { AUTH_NO_STORE, redirectAuthenticatedUser } from "~/auth/guest-only.server";
import { pendingOtpSetCookie } from "~/auth/pending-otp";
import { authPath } from "~/auth/referer";
import { FormError } from "~/components/forms/form-primitives";
import { cn } from "~/lib/utils";
import { buildPageMetadata } from "~/seo/metadata";
import type { Route } from "./+types/auth";

export const meta = () =>
  buildPageMetadata({
    title: "Log in | Tripdly",
    description: "Sign in or create your Tripdly account with a one-time email code.",
    path: "/auth",
    index: false,
  });

export async function loader({ request }: Route.LoaderArgs) {
  await redirectAuthenticatedUser(request);
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema: loginFormSchema });

  if (submission.status !== "success") {
    return data(submission.reply(), { status: HTTP_STATUS.BAD_REQUEST, headers: AUTH_NO_STORE });
  }

  const referralCode = submission.value.referralCode || undefined;
  const search = new URL(request.url).searchParams;

  try {
    await sendSignInOtp({
      request,
      email: submission.value.email,
      role: "user",
      referralCode,
    });
  } catch (error) {
    if (error instanceof ApiRequestError && error.kind === "aborted") {
      throw error;
    }

    return data(submission.reply({ formErrors: [authClientErrorMessage(error)] }), {
      status: authClientErrorStatus(error),
      headers: AUTH_NO_STORE,
    });
  }

  const headers = authResponseHeaders();
  headers.append(
    "Set-Cookie",
    pendingOtpSetCookie(
      {
        email: submission.value.email,
        referralCode,
      },
      isSecureAuthCookie(),
    ),
  );

  throw redirect(authPath("/verify", { redirectTo: search.get("redirectTo") }), {
    headers,
  });
}

export default function AuthPage({ actionData }: Route.ComponentProps) {
  const [searchParams] = useSearchParams();
  const navigation = useNavigation();
  const referralFromUrl = validReferralCode(searchParams.get("ref"));
  const isSubmitting = navigation.formMethod != null;
  const [form, fields] = useForm({
    id: "login",
    lastResult: actionData,
    constraint: getZodConstraint(loginFormSchema),
    shouldValidate: "onSubmit",
    shouldRevalidate: "onInput",
    defaultValue: {
      referralCode: referralFromUrl,
    },
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: loginFormSchema });
    },
  });
  const { email, referralCode, acceptTerms } = fields;

  return (
    <>
      <h1 className="sr-only">Log in</h1>

      <Form method="post" {...getFormProps(form)}>
        <div className="flex flex-col gap-4">
          <div>
            <input
              {...getInputProps(email, { type: "email" })}
              autoComplete="email"
              spellCheck={false}
              placeholder="Email"
              aria-label="Email"
              className={cn(
                "h-12 w-full rounded-sm border-2 border-transparent bg-neutral-100 px-3 py-2 text-base text-neutral-900 placeholder:text-neutral-500 focus-visible:border-neutral-900 focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50",
                email.errors && "border-red-500",
              )}
            />
            <FormError id={email.errorId} errors={email.errors} />
          </div>

          <div>
            <input
              {...getInputProps(referralCode, { type: "text" })}
              autoComplete="off"
              spellCheck={false}
              placeholder="Referral code (optional)"
              aria-label="Referral code (optional)"
              className={cn(
                "h-12 w-full rounded-sm border-2 border-transparent bg-neutral-100 px-3 py-2 text-base text-neutral-900 placeholder:text-neutral-500 focus-visible:border-neutral-900 focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50",
                referralCode.errors && "border-red-500",
              )}
            />
            <FormError id={referralCode.errorId} errors={referralCode.errors} />
          </div>

          <div>
            <label
              htmlFor={acceptTerms.id}
              className="flex cursor-pointer items-start gap-2.5 text-sm text-neutral-600"
            >
              <AuthCheckbox
                {...getInputProps(acceptTerms, { type: "checkbox", value: "on" })}
                aria-label="I agree to Tripdly's Terms of Service and Privacy Policy"
                className={acceptTerms.errors ? "border-red-500" : undefined}
              />
              <span>
                I agree to Tripdly&apos;s{" "}
                <Link to="/terms" className="underline" target="_blank" rel="noopener noreferrer">
                  Terms
                </Link>{" "}
                and{" "}
                <Link to="/privacy" className="underline" target="_blank" rel="noopener noreferrer">
                  Privacy Policy
                </Link>
              </span>
            </label>
            <FormError id={acceptTerms.errorId} errors={acceptTerms.errors} />
          </div>

          <FormError id={form.errorId} errors={form.errors} />

          <AuthSubmitButton
            pending={isSubmitting}
            pendingLabel="Sending code…"
            ariaLabel={isSubmitting ? "Sending verification code" : "Continue"}
          >
            Continue
          </AuthSubmitButton>
        </div>
      </Form>
    </>
  );
}
