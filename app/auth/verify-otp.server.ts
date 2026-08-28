import type { SubmissionResult } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { data, redirect } from "react-router";

import { ApiRequestError } from "~/api/api.server";
import { isSecureAuthCookie, sendSignInOtp, verifySignInOtp } from "~/api/auth/auth.server";
import { authResponseHeaders } from "~/api/auth/cookie-relay.server";
import { authClientErrorMessage, authClientErrorStatus } from "~/api/auth/errors";
import type { AuthRole } from "~/api/auth/schema";
import { HTTP_STATUS } from "~/api/http-status";
import { type PendingOtp, verifyFormSchema } from "~/auth/auth-form-schema";
import { AUTH_NO_STORE } from "~/auth/guest-only.server";
import {
  type PendingOtpScope,
  parsePendingOtp,
  pendingOtpClearCookie,
  pendingOtpCookieName,
  pendingOtpSetCookie,
  readCookieValue,
} from "~/auth/pending-otp";

export type OtpVerificationFlow = {
  readonly role: AuthRole;
  readonly scope: PendingOtpScope;
  readonly loginHref: (request: Request, pending?: PendingOtp | null) => string;
  readonly successRedirect: (request: Request) => string;
};

function readPendingOtp(request: Request, scope: PendingOtpScope) {
  const secure = isSecureAuthCookie();
  return parsePendingOtp(
    readCookieValue(request.headers.get("Cookie"), pendingOtpCookieName(secure, scope)),
  );
}

function formErrorResult(message: string): SubmissionResult<string[]> {
  return { status: "error", error: { "": [message] } };
}

async function resendOtp(request: Request, pending: PendingOtp, flow: OtpVerificationFlow) {
  try {
    await sendSignInOtp({
      request,
      email: pending.email,
      role: flow.role,
      ...(flow.role === "user" ? { referralCode: pending.referralCode } : {}),
    });
    const headers = authResponseHeaders();
    headers.append("Set-Cookie", pendingOtpSetCookie(pending, isSecureAuthCookie(), flow.scope));
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

function verificationFailure(
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

export function loadOtpVerification(request: Request, flow: OtpVerificationFlow) {
  const pending = readPendingOtp(request, flow.scope);

  if (!pending) {
    throw redirect(flow.loginHref(request), { headers: AUTH_NO_STORE });
  }

  return { email: pending.email, loginHref: flow.loginHref(request, pending) };
}

export async function handleOtpVerification(request: Request, flow: OtpVerificationFlow) {
  const pending = readPendingOtp(request, flow.scope);

  if (!pending) {
    throw redirect(flow.loginHref(request), { headers: AUTH_NO_STORE });
  }

  const formData = await request.formData();
  const intentValue = formData.get("intent");
  const intent = typeof intentValue === "string" ? intentValue : "verify";

  if (intent === "resend") {
    return resendOtp(request, pending, flow);
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
      role: flow.role,
    });
    headers = authResponseHeaders(response.headers);
    headers.append("Set-Cookie", pendingOtpClearCookie(isSecureAuthCookie(), flow.scope));
  } catch (error) {
    if (error instanceof ApiRequestError && error.kind === "aborted") {
      throw error;
    }

    return verificationFailure(submission, error);
  }

  throw redirect(flow.successRedirect(request), { headers });
}
