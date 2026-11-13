import { redirect } from "react-router";
import { validReferralCode } from "~/auth/auth-form-schema";
import type { Route } from "./+types/r.$code";

export function loader({ params }: Route.LoaderArgs) {
  const code = validReferralCode(params.code);

  if (!code) {
    throw new Response("Referral link not found", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

  throw redirect(`/auth?ref=${encodeURIComponent(code)}`, {
    headers: { "Cache-Control": "no-store" },
  });
}
