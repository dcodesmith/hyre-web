import { redirect } from "react-router";

import { ApiRequestError } from "~/api/api.server";
import { getAuthSession } from "~/api/auth/auth.server";
import { hasSessionCookie } from "~/api/auth/cookie-relay.server";
import { safeRedirectPath } from "~/auth/referer";

export const AUTH_NO_STORE = { "Cache-Control": "private, no-store" };

export async function redirectAuthenticatedUser(request: Request) {
  if (!hasSessionCookie(request.headers.get("Cookie"))) {
    return;
  }

  try {
    const session = await getAuthSession({ request });

    if (session) {
      throw redirect(safeRedirectPath(new URL(request.url).searchParams.get("redirectTo")), {
        headers: AUTH_NO_STORE,
      });
    }
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }

    if (error instanceof ApiRequestError && error.kind === "aborted") {
      throw error;
    }
  }
}
