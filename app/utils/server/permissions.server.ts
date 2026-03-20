import { data } from "react-router";
import logger from "~/lib/logger.server";
import { requireUser } from "~/modules/auth/auth.server";
import { RoleName, userHasRole } from "~/utils/shared/roles";
import { getLoginUrlForRole } from "./auth-helpers.server";

export async function requireUserWithRole(request: Request, name: RoleName) {
  const url = new URL(request.url);
  const redirectTo = url.pathname + url.search;
  const loginUrl = getLoginUrlForRole(name, redirectTo);

  const user = await requireUser(request, { redirectTo: loginUrl });
  const hasRole = userHasRole(user, name);

  // for security reasons, do we wanna tell you the user they have no access or just redirect them to the home page like the page doesn't exist
  if (!hasRole) {
    logger.error(`Unauthorized: required role: ${name}:`, user);
    throw data(
      {
        error: "Unauthorized",
        requiredRole: name,
        message: `Unauthorized: required role: ${name}`,
      },
      { status: 403 },
    );
  }

  return user;
}
