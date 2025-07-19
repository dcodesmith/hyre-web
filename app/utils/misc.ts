import { SerializeFrom } from "@remix-run/node";
import { useRouteLoaderData } from "@remix-run/react";
import { loader as rootLoader } from "~/root";

/**
 * Use root-loader data.
 */
function isUser(user: unknown): user is SerializeFrom<typeof rootLoader>["user"] {
  return Boolean(user && typeof user === "object" && "id" in user && typeof user.id === "string");
}

export function useOptionalUser() {
  const data = useRouteLoaderData<typeof rootLoader>("root");

  if (!data || !isUser(data.user)) {
    return undefined;
  }

  return data.user;
}

export function useUser() {
  const optionalUser = useOptionalUser();

  if (!optionalUser) {
    throw new Error("No user found in root loader.");
  }

  return optionalUser;
}
/**
 * Permissions.
 * Implementation based on github.com/epicweb-dev/epic-stack
 */
export type RoleName = "user" | "fleetOwner" | "admin" | "chauffeur" | "staff";

export function userHasRole(
  user: Pick<ReturnType<typeof useUser>, "roles"> | null,
  roleName: RoleName,
) {
  if (!user) {
    return false;
  }

  return user.roles.some((role) => role.name === roleName);
}
