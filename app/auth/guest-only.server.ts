import { redirect } from "react-router";

import { ApiRequestError } from "~/api/api.server";
import { hasSessionCookie } from "~/api/auth/cookie-relay.server";
import { HTTP_STATUS } from "~/api/http-status";
import { getCurrentUserProfile } from "~/api/users/users.server";
import { safeRedirectPath } from "~/auth/referer";

export const AUTH_NO_STORE = { "Cache-Control": "private, no-store" };

export async function redirectAuthenticatedUser(request: Request) {
  if (!hasSessionCookie(request.headers.get("Cookie"))) {
    return;
  }

  try {
    await getCurrentUserProfile({ request });
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === HTTP_STATUS.UNAUTHORIZED) {
      return;
    }
    throw error;
  }

  throw redirect(safeRedirectPath(new URL(request.url).searchParams.get("redirectTo")), {
    headers: AUTH_NO_STORE,
  });
}
