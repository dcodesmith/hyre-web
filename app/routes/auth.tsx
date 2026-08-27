import { parseWithZod } from "@conform-to/zod/v4";
import { data, redirect, useSearchParams } from "react-router";
import { ApiRequestError } from "~/api/api.server";
import { isSecureAuthCookie, sendSignInOtp } from "~/api/auth/auth.server";
import { authResponseHeaders } from "~/api/auth/cookie-relay.server";
import { authClientErrorMessage, authClientErrorStatus } from "~/api/auth/errors";
import { HTTP_STATUS } from "~/api/http-status";
import { loginFormSchema, validReferralCode } from "~/auth/auth-form-schema";
import { AUTH_NO_STORE, redirectAuthenticatedUser } from "~/auth/guest-only.server";
import { LoginForm } from "~/auth/login-form";
import { pendingOtpSetCookie } from "~/auth/pending-otp";
import { authPath } from "~/auth/referer";
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
  const referralFromUrl = validReferralCode(searchParams.get("ref"));
  return (
    <LoginForm
      actionData={actionData}
      authRole="user"
      heading="Log in"
      id="login"
      referralCode={referralFromUrl}
    />
  );
}
