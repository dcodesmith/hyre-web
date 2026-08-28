import { redirectAuthenticatedAdmin } from "~/auth/admin-session.server";
import type { PendingOtp } from "~/auth/auth-form-schema";
import { adminAuthPath, safeAdminRedirectPath } from "~/auth/referer";
import { VerifyForm } from "~/auth/verify-form";
import {
  handleOtpVerification,
  loadOtpVerification,
  type OtpVerificationFlow,
} from "~/auth/verify-otp.server";
import { buildPageMetadata } from "~/seo/metadata";
import type { Route } from "./+types/admin.verify";

export const meta = () =>
  buildPageMetadata({
    title: "Verify Admin Email | Tripdly",
    description: "Enter the one-time code sent to your email to finish signing in.",
    path: "/admin/verify",
    index: false,
  });

function loginHref(request: Request, pending?: PendingOtp | null) {
  return adminAuthPath("/admin/login", {
    redirectTo: new URL(request.url).searchParams.get("redirectTo"),
    role: pending?.role,
  });
}

const verificationFlow = {
  role(pending: PendingOtp) {
    return pending.role ?? null;
  },
  scope: "admin",
  loginHref,
  successRedirect(request: Request) {
    return safeAdminRedirectPath(new URL(request.url).searchParams.get("redirectTo"));
  },
} satisfies OtpVerificationFlow;

export async function loader({ request }: Route.LoaderArgs) {
  await redirectAuthenticatedAdmin(request);
  return loadOtpVerification(request, verificationFlow);
}

export async function action({ request }: Route.ActionArgs) {
  return handleOtpVerification(request, verificationFlow);
}

export default function AdminVerifyPage({ loaderData, actionData }: Route.ComponentProps) {
  return (
    <VerifyForm
      actionData={actionData}
      email={loaderData.email}
      heading="Verify Admin Portal Email"
      loginHref={loaderData.loginHref}
    />
  );
}
