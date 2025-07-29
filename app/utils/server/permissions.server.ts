import { json } from "@remix-run/node";
import logger from "~/lib/logger.server";
import { requireUser } from "~/modules/auth/auth.server";
import { RoleName, userHasRole } from "~/utils/client/misc";

export async function requireUserWithRole(request: Request, name: RoleName) {
  const user = await requireUser(request, { redirectTo: "/auth" });
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
