import { data, redirect } from "react-router";

import type { AccountDeletionActionData } from "~/account/account-deletion";
import { deleteCurrentUserAccount } from "~/api/account/account.server";
import { ApiRequestError } from "~/api/api.server";
import { isSecureAuthCookie } from "~/api/auth/auth.server";
import {
  authResponseHeaders,
  expireSessionCookies,
  hasSessionCookie,
} from "~/api/auth/cookie-relay.server";
import { HTTP_STATUS } from "~/api/http-status";
import { pendingOtpClearCookie } from "~/auth/pending-otp";
import { authPath } from "~/auth/referer";
import type { Route } from "./+types/api.account.delete";

const PROFILE_PATH = "/profile";

function loginRedirect() {
  return redirect(authPath("/auth", { redirectTo: PROFILE_PATH }), {
    headers: authResponseHeaders(),
  });
}

export async function action({ request }: Route.ActionArgs) {
  const cookieHeader = request.headers.get("Cookie");

  if (!hasSessionCookie(cookieHeader)) {
    throw loginRedirect();
  }

  try {
    await deleteCurrentUserAccount({ request });
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === HTTP_STATUS.UNAUTHORIZED) {
      throw loginRedirect();
    }

    if (error instanceof ApiRequestError && error.kind === "aborted") {
      throw error;
    }

    const message =
      error instanceof ApiRequestError && error.status < HTTP_STATUS.INTERNAL_SERVER_ERROR
        ? error.problem.detail
        : "Failed to delete account. Please try again.";

    return data<AccountDeletionActionData>(
      { error: message },
      {
        status: error instanceof ApiRequestError ? error.status : HTTP_STATUS.BAD_GATEWAY,
        headers: authResponseHeaders(),
      },
    );
  }

  const headers = authResponseHeaders();

  for (const cookie of expireSessionCookies(cookieHeader)) {
    headers.append("Set-Cookie", cookie);
  }
  headers.append("Set-Cookie", pendingOtpClearCookie(isSecureAuthCookie()));

  throw redirect("/auth", { headers });
}
