import type { PendingOtp } from "~/auth/auth-form-schema";
import { redirectAuthenticatedUser } from "~/auth/guest-only.server";
import { authPath, safeRedirectPath } from "~/auth/referer";
import { VerifyForm } from "~/auth/verify-form";
import {
  handleOtpVerification,
  loadOtpVerification,
  type OtpVerificationFlow,
} from "~/auth/verify-otp.server";
import { buildPageMetadata } from "~/seo/metadata";
import type { Route } from "./+types/verify";

export const meta = () =>
  buildPageMetadata({
    title: "Verify email | Tripdly",
    description: "Enter the one-time code sent to your email to finish signing in.",
    path: "/verify",
    index: false,
  });

function loginHref(request: Request, pending?: PendingOtp | null) {
  const search = new URL(request.url).searchParams;

  return authPath("/auth", {
    redirectTo: search.get("redirectTo"),
    ref: pending?.referralCode ?? search.get("ref"),
  });
}

const verificationFlow = {
  role: "user",
  scope: "user",
  loginHref,
  successRedirect(request: Request) {
    return safeRedirectPath(new URL(request.url).searchParams.get("redirectTo"));
  },
} satisfies OtpVerificationFlow;

export async function loader({ request }: Route.LoaderArgs) {
  await redirectAuthenticatedUser(request);
  return loadOtpVerification(request, verificationFlow);
}

export async function action({ request }: Route.ActionArgs) {
  return handleOtpVerification(request, verificationFlow);
}

export default function VerifyPage({ loaderData, actionData }: Route.ComponentProps) {
  return (
    <VerifyForm actionData={actionData} email={loaderData.email} loginHref={loaderData.loginHref} />
  );
}
