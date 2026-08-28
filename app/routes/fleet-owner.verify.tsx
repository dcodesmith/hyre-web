import { redirectAuthenticatedFleetOwner } from "~/auth/fleet-owner-session.server";
import { fleetOwnerAuthPath, safeFleetOwnerRedirectPath } from "~/auth/referer";
import { VerifyForm } from "~/auth/verify-form";
import {
  handleOtpVerification,
  loadOtpVerification,
  type OtpVerificationFlow,
} from "~/auth/verify-otp.server";
import { buildPageMetadata } from "~/seo/metadata";
import type { Route } from "./+types/fleet-owner.verify";

export const meta = () =>
  buildPageMetadata({
    title: "Verify Fleet Owner Email | Tripdly",
    description: "Enter the one-time code sent to your email to finish signing in.",
    path: "/fleet-owner/verify",
    index: false,
  });

function loginHref(request: Request) {
  return fleetOwnerAuthPath(
    "/fleet-owner/login",
    new URL(request.url).searchParams.get("redirectTo"),
  );
}

const verificationFlow = {
  role: "fleetOwner",
  scope: "fleetOwner",
  loginHref,
  successRedirect(request: Request) {
    return safeFleetOwnerRedirectPath(new URL(request.url).searchParams.get("redirectTo"));
  },
} satisfies OtpVerificationFlow;

export async function loader({ request }: Route.LoaderArgs) {
  await redirectAuthenticatedFleetOwner(request);
  return loadOtpVerification(request, verificationFlow);
}

export async function action({ request }: Route.ActionArgs) {
  return handleOtpVerification(request, verificationFlow);
}

export default function FleetOwnerVerifyPage({ loaderData, actionData }: Route.ComponentProps) {
  return (
    <VerifyForm
      actionData={actionData}
      email={loaderData.email}
      heading="Verify Fleet Owner Email"
      loginHref={loaderData.loginHref}
    />
  );
}
