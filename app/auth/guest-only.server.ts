import { redirect } from "react-router";

import { safeRedirectPath } from "~/auth/referer";
import { readAuthUser } from "~/auth/session.server";

export const AUTH_NO_STORE = { "Cache-Control": "private, no-store" };

export async function redirectAuthenticatedUser(request: Request) {
  const user = await readAuthUser(request);

  if (!user) {
    return;
  }

  throw redirect(safeRedirectPath(new URL(request.url).searchParams.get("redirectTo")), {
    headers: AUTH_NO_STORE,
  });
}
