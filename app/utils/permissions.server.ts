/**
 * Permissions and Roles.
 * Implementation based on github.com/epicweb-dev/epic-stack
 */
import { json } from "@remix-run/node";
import { requireUser } from "~/modules/auth/auth.server";
import { RoleName, userHasRole } from "~/utils/misc";
// import { ROUTE_PATH as LOGIN_PATH } from "~/routes/auth+/login";
// export type RoleName = "user" | "client" | "admin";

export async function requireUserWithRole(request: Request, name: RoleName) {
  const user = await requireUser(request, { redirectTo: "/auth" });
  const hasRole = userHasRole(user, name);

  // for security reasons, do we wanna tell you the user they have no access or just redirect them to the home page like the page doesn't exist
  if (!hasRole) {
    throw json(
      {
        error: "Unauthorized",
        requiredRole: name,
        message: `Unauthorized: required role: ${name}`,
      },
      { status: 403 }
    );
  }

  return user;
}
