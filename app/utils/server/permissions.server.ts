import { json } from "@remix-run/node";
import logger from "~/lib/logger.server";
import { requireUser } from "~/modules/auth/auth.server";
import { RoleName, userHasRole } from "~/utils/client/misc";

export async function requireUserWithRole(request: Request, name: RoleName) {
  const url = new URL(request.url);
  const searchParams = new URLSearchParams(url.searchParams);

  // Add the required role to the search params for the auth redirect
  searchParams.set("role", name);
  // Also set redirectTo to the current URL so user gets redirected back after auth
  searchParams.set("redirectTo", url.pathname + url.search);

  const user = await requireUser(request, { redirectTo: `/auth?${searchParams.toString()}` });
  const hasRole = userHasRole(user, name);

  // for security reasons, do we wanna tell you the user they have no access or just redirect them to the home page like the page doesn't exist
  if (!hasRole) {
    logger.error(`Unauthorized: required role: ${name}:`, user);
    throw json(
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
