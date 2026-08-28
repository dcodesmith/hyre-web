import { data, redirect } from "react-router";

import { HTTP_STATUS } from "~/api/http-status";
import type { AdminPortalRole } from "~/auth/auth-form-schema";
import { AUTH_NO_STORE } from "~/auth/guest-only.server";
import { adminAuthPath, safeAdminRedirectPath } from "~/auth/referer";
import { readAuthSessionUser } from "~/auth/session.server";

function getAdminPortalRole(roles: readonly string[]): AdminPortalRole | null {
  if (roles.includes("admin")) {
    return "admin";
  }

  return roles.includes("staff") ? "staff" : null;
}

export async function redirectAuthenticatedAdmin(request: Request) {
  const user = await readAuthSessionUser(request);

  if (!user) {
    return;
  }

  if (!getAdminPortalRole(user.roles)) {
    throw redirect("/", { headers: AUTH_NO_STORE });
  }

  const redirectTo = new URL(request.url).searchParams.get("redirectTo");

  throw redirect(safeAdminRedirectPath(redirectTo), { headers: AUTH_NO_STORE });
}

export async function requireAdminOrStaff(request: Request) {
  const user = await readAuthSessionUser(request);

  if (!user) {
    const url = new URL(request.url);
    const redirectTo = `${url.pathname}${url.search}`;

    throw redirect(adminAuthPath("/admin/login", { redirectTo }), {
      headers: AUTH_NO_STORE,
    });
  }

  const role = getAdminPortalRole(user.roles);

  if (!role) {
    throw data(null, { status: HTTP_STATUS.FORBIDDEN, headers: AUTH_NO_STORE });
  }

  return { role, user };
}
