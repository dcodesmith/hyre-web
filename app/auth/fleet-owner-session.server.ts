import { data, redirect } from "react-router";

import { HTTP_STATUS } from "~/api/http-status";
import { AUTH_NO_STORE } from "~/auth/guest-only.server";
import { fleetOwnerAuthPath, safeFleetOwnerRedirectPath } from "~/auth/referer";
import { readAuthSessionUser } from "~/auth/session.server";

export async function redirectAuthenticatedFleetOwner(request: Request) {
  const user = await readAuthSessionUser(request);

  if (!user) {
    return;
  }

  if (!user.roles.includes("fleetOwner")) {
    throw redirect("/", { headers: AUTH_NO_STORE });
  }

  const redirectTo = new URL(request.url).searchParams.get("redirectTo");
  throw redirect(safeFleetOwnerRedirectPath(redirectTo), { headers: AUTH_NO_STORE });
}

export async function requireFleetOwner(request: Request) {
  const user = await readAuthSessionUser(request);

  if (!user) {
    const url = new URL(request.url);
    const redirectTo = `${url.pathname}${url.search}`;
    throw redirect(fleetOwnerAuthPath("/fleet-owner/login", redirectTo), {
      headers: AUTH_NO_STORE,
    });
  }

  if (!user.roles.includes("fleetOwner")) {
    throw data(null, { status: HTTP_STATUS.FORBIDDEN, headers: AUTH_NO_STORE });
  }

  return user;
}
