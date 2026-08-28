import { parseWithZod } from "@conform-to/zod/v4";
import { data, redirect } from "react-router";

import { ApiRequestError } from "~/api/api.server";
import { isSecureAuthCookie, sendSignInOtp } from "~/api/auth/auth.server";
import { authResponseHeaders } from "~/api/auth/cookie-relay.server";
import { authClientErrorMessage, authClientErrorStatus } from "~/api/auth/errors";
import { HTTP_STATUS } from "~/api/http-status";
import { redirectAuthenticatedAdmin } from "~/auth/admin-session.server";
import { adminLoginFormSchema, adminPortalRoleSchema } from "~/auth/auth-form-schema";
import { AUTH_NO_STORE } from "~/auth/guest-only.server";
import { LoginForm } from "~/auth/login-form";
import { pendingOtpSetCookie } from "~/auth/pending-otp";
import { adminAuthPath } from "~/auth/referer";
import { buildPageMetadata } from "~/seo/metadata";
import type { Route } from "./+types/admin.login";

export const meta = () =>
  buildPageMetadata({
    title: "Admin Login | Tripdly",
    description: "Sign in to the Tripdly admin portal with a one-time email code.",
    path: "/admin/login",
    index: false,
  });

export async function loader({ request }: Route.LoaderArgs) {
  await redirectAuthenticatedAdmin(request);
  const requestedRole = adminPortalRoleSchema.safeParse(
    new URL(request.url).searchParams.get("role"),
  );
  return { defaultRole: requestedRole.success ? requestedRole.data : "admin" };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema: adminLoginFormSchema });

  if (submission.status !== "success") {
    return data(submission.reply(), { status: HTTP_STATUS.BAD_REQUEST, headers: AUTH_NO_STORE });
  }

  const { email, role } = submission.value;

  try {
    await sendSignInOtp({ request, email, role });
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
  headers.append("Set-Cookie", pendingOtpSetCookie({ email, role }, isSecureAuthCookie(), "admin"));

  const redirectTo = new URL(request.url).searchParams.get("redirectTo");
  throw redirect(adminAuthPath("/admin/verify", { redirectTo }), { headers });
}

export default function AdminLoginPage({ actionData, loaderData }: Route.ComponentProps) {
  return (
    <LoginForm
      actionData={actionData}
      authRole={loaderData.defaultRole}
      heading="Admin Portal Login"
      id="admin-login"
    />
  );
}
