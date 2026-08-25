import { getFormProps, getInputProps, type SubmissionResult, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { data, Form, Link, redirect, useNavigation } from "react-router";

import { ApiRequestError } from "~/api/api.server";
import { isSecureAuthCookie, sendSignInOtp, verifySignInOtp } from "~/api/auth/auth.server";
import { authResponseHeaders } from "~/api/auth/cookie-relay.server";
import { authClientErrorMessage, authClientErrorStatus } from "~/api/auth/errors";
import { HTTP_STATUS } from "~/api/http-status";
import {
  AUTH_INPUT_CLASS,
  AUTH_INPUT_INVALID_CLASS,
  AuthError,
  AuthSubmitButton,
} from "~/auth/auth-form-primitives";
import { type PendingOtp, verifyFormSchema } from "~/auth/auth-form-schema";
import { AUTH_NO_STORE, redirectAuthenticatedUser } from "~/auth/guest-only.server";
import {
  parsePendingOtp,
  pendingOtpClearCookie,
  pendingOtpCookieName,
  pendingOtpSetCookie,
  readCookieValue,
} from "~/auth/pending-otp";
import { authPath, safeRedirectPath } from "~/auth/referer";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { buildPageMetadata } from "~/seo/metadata";
import type { Route } from "./+types/verify";

export const meta = () =>
  buildPageMetadata({
    title: "Verify email | Tripdly",
    description: "Enter the one-time code sent to your email to finish signing in.",
    path: "/verify",
    index: false,
  });

function readPendingOtp(request: Request) {
  return parsePendingOtp(
    readCookieValue(request.headers.get("Cookie"), pendingOtpCookieName(isSecureAuthCookie())),
  );
}

function loginHref(request: Request, pending?: PendingOtp | null) {
  const search = new URL(request.url).searchParams;

  return authPath("/auth", {
    redirectTo: search.get("redirectTo"),
    ref: pending?.referralCode ?? search.get("ref"),
  });
}

function formErrorResult(message: string): SubmissionResult<string[]> {
  return { status: "error", error: { "": [message] } };
}

async function resendOtpAction(request: Request, pending: PendingOtp) {
  try {
    await sendSignInOtp({
      request,
      email: pending.email,
      role: "user",
      referralCode: pending.referralCode,
    });
    const headers = authResponseHeaders();
    headers.append("Set-Cookie", pendingOtpSetCookie(pending, isSecureAuthCookie()));
    return data({ lastResult: null, notice: "A new code is on its way." }, { headers });
  } catch (error) {
    if (error instanceof ApiRequestError && error.kind === "aborted") {
      throw error;
    }

    return data(
      { lastResult: formErrorResult(authClientErrorMessage(error)), notice: undefined },
      { status: authClientErrorStatus(error), headers: AUTH_NO_STORE },
    );
  }
}

function verifyOtpFailure(
  submission: {
    reply: (options: {
      fieldErrors?: { code: string[] };
      formErrors?: string[];
    }) => SubmissionResult<string[]>;
  },
  error: unknown,
) {
  const message = authClientErrorMessage(error);
  const lastResult =
    error instanceof ApiRequestError && error.status === HTTP_STATUS.BAD_REQUEST
      ? submission.reply({ fieldErrors: { code: [message] } })
      : submission.reply({ formErrors: [message] });

  return data(
    { lastResult, notice: undefined },
    { status: authClientErrorStatus(error), headers: AUTH_NO_STORE },
  );
}

export async function loader({ request }: Route.LoaderArgs) {
  await redirectAuthenticatedUser(request);

  const pending = readPendingOtp(request);

  if (!pending) {
    throw redirect(loginHref(request), { headers: AUTH_NO_STORE });
  }

  return { email: pending.email, loginHref: loginHref(request, pending) };
}

export async function action({ request }: Route.ActionArgs) {
  const pending = readPendingOtp(request);

  if (!pending) {
    throw redirect(loginHref(request), { headers: AUTH_NO_STORE });
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "verify");
  const redirectTo = safeRedirectPath(new URL(request.url).searchParams.get("redirectTo"));

  if (intent === "resend") {
    return resendOtpAction(request, pending);
  }

  const submission = parseWithZod(formData, { schema: verifyFormSchema });

  if (submission.status !== "success") {
    return data(
      { lastResult: submission.reply(), notice: undefined },
      { status: HTTP_STATUS.BAD_REQUEST, headers: AUTH_NO_STORE },
    );
  }

  let headers: Headers;

  try {
    const response = await verifySignInOtp({
      request,
      email: pending.email,
      otp: submission.value.code,
      role: "user",
    });
    headers = authResponseHeaders(response.headers);
    headers.append("Set-Cookie", pendingOtpClearCookie(isSecureAuthCookie()));
  } catch (error) {
    if (error instanceof ApiRequestError && error.kind === "aborted") {
      throw error;
    }

    return verifyOtpFailure(submission, error);
  }

  throw redirect(redirectTo, { headers });
}

export default function VerifyPage({ loaderData, actionData }: Route.ComponentProps) {
  const { email, loginHref } = loaderData;
  const navigation = useNavigation();
  const intent = navigation.formData?.get("intent");
  const isFormPending = navigation.formMethod != null;
  const isVerifyPending = isFormPending && intent === "verify";
  const isResendPending = isFormPending && intent === "resend";
  const [form, fields] = useForm({
    id: "verify-otp",
    lastResult: actionData?.lastResult ?? null,
    constraint: getZodConstraint(verifyFormSchema),
    shouldValidate: "onSubmit",
    shouldRevalidate: "onInput",
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: verifyFormSchema });
    },
  });
  const { code } = fields;

  return (
    <>
      <h1 className="sr-only">Verify email</h1>
      <p className="mb-4 text-sm text-neutral-600">Code sent to {email}</p>

      <Form method="post" {...getFormProps(form)}>
        <input type="hidden" name="intent" value="verify" />
        <div className="flex flex-col gap-4">
          <div>
            <input
              {...getInputProps(code, { type: "text" })}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              spellCheck={false}
              placeholder="6-digit code"
              aria-label="Verification code"
              className={cn(
                AUTH_INPUT_CLASS,
                "tracking-[0.3em]",
                code.errors && AUTH_INPUT_INVALID_CLASS,
              )}
            />
            <AuthError id={code.errorId} errors={code.errors} />
          </div>

          <AuthError id={form.errorId} errors={form.errors} />
          {actionData?.notice ? (
            <p className="text-sm text-neutral-600" aria-live="polite">
              {actionData.notice}
            </p>
          ) : null}

          <AuthSubmitButton
            pending={isVerifyPending}
            pendingLabel="Verifying…"
            ariaLabel={isVerifyPending ? "Verifying code" : "Continue"}
          >
            Continue
          </AuthSubmitButton>
        </div>
      </Form>

      <div className="mt-4 flex items-center gap-1 text-sm text-neutral-600">
        <span>Didn&apos;t get it?</span>
        <Form method="post">
          <input type="hidden" name="intent" value="resend" />
          <Button
            type="submit"
            variant="ghost"
            disabled={isVerifyPending || isResendPending}
            className="h-auto px-1 py-0 text-sm font-medium text-neutral-900 hover:bg-transparent hover:underline"
          >
            {isResendPending ? "Sending…" : "Resend code"}
          </Button>
        </Form>
      </div>

      <p className="mt-6 text-sm text-neutral-600">
        Wrong email?{" "}
        <Link to={loginHref} className="font-medium text-neutral-900 underline">
          Start again
        </Link>
      </p>
    </>
  );
}
