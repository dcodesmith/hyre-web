import { parseWithZod } from "@conform-to/zod/v4";
import { data, redirect } from "react-router";

import { ApiRequestError } from "~/api/api.server";
import { isSecureAuthCookie, sendSignInOtp } from "~/api/auth/auth.server";
import { authResponseHeaders } from "~/api/auth/cookie-relay.server";
import { authClientErrorMessage, authClientErrorStatus } from "~/api/auth/errors";
import { HTTP_STATUS } from "~/api/http-status";
import { fleetOwnerLoginFormSchema } from "~/auth/auth-form-schema";
import { redirectAuthenticatedFleetOwner } from "~/auth/fleet-owner-session.server";
import { AUTH_NO_STORE } from "~/auth/guest-only.server";
import { LoginForm } from "~/auth/login-form";
import { pendingOtpSetCookie } from "~/auth/pending-otp";
import { fleetOwnerAuthPath } from "~/auth/referer";
import { buildPageMetadata } from "~/seo/metadata";
import type { Route } from "./+types/fleet-owner.login";

export const meta = () =>
  buildPageMetadata({
    title: "Fleet Owner Login | Tripdly",
    description: "Sign in or create your Tripdly fleet-owner account with a one-time email code.",
    path: "/fleet-owner/login",
    index: false,
  });

export async function loader({ request }: Route.LoaderArgs) {
  await redirectAuthenticatedFleetOwner(request);
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema: fleetOwnerLoginFormSchema });

  if (submission.status !== "success") {
    return data(submission.reply(), { status: HTTP_STATUS.BAD_REQUEST, headers: AUTH_NO_STORE });
  }

  try {
    await sendSignInOtp({
      request,
      email: submission.value.email,
      role: "fleetOwner",
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
    pendingOtpSetCookie({ email: submission.value.email }, isSecureAuthCookie(), "fleetOwner"),
  );

  const redirectTo = new URL(request.url).searchParams.get("redirectTo");
  throw redirect(fleetOwnerAuthPath("/fleet-owner/verify", redirectTo), { headers });
}

export default function FleetOwnerLoginPage({ actionData }: Route.ComponentProps) {
  return <LoginForm actionData={actionData} heading="Fleet Owner Login" id="fleet-owner-login" />;
}
