import { redirect } from "react-router";

import { ApiRequestError } from "~/api/api.server";
import { isSecureAuthCookie, signOut } from "~/api/auth/auth.server";
import { authResponseHeaders, expireSessionCookies } from "~/api/auth/cookie-relay.server";
import { pendingOtpClearCookie } from "~/auth/pending-otp";
import type { Route } from "./+types/admin.logout";

export function loader() {
  throw redirect("/admin", { headers: { "Cache-Control": "private, no-store" } });
}

export async function action({ request }: Route.ActionArgs) {
  let headers = authResponseHeaders();

  try {
    const response = await signOut({ request, role: "admin" });
    headers = authResponseHeaders(response.headers);
  } catch (error) {
    if (error instanceof ApiRequestError && error.kind === "aborted") {
      throw error;
    }
  }

  for (const cookie of expireSessionCookies(request.headers.get("Cookie"))) {
    headers.append("Set-Cookie", cookie);
  }
  headers.append("Set-Cookie", pendingOtpClearCookie(isSecureAuthCookie(), "admin"));

  throw redirect("/admin/login", { headers });
}
