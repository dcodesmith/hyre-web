import { useRouteLoaderData } from "@remix-run/react";
import type { User } from "@prisma/client";

/**
 * Use root-loader data.
 */
export type RootLoaderData = {
  user: (User & { roles: { name: string }[] }) | null;
  ENV: {
    APP_NAME: string;
    GOOGLE_MAPS_API_KEY: string;
  };
  csrfToken: string;
};

function isUser(user: unknown): user is User & { roles: { name: string }[] } {
  return Boolean(user && typeof user === "object" && "id" in user && typeof user.id === "string");
}

export function useOptionalUser(): (User & { roles: { name: string }[] }) | undefined {
  const data = useRouteLoaderData<RootLoaderData>("root");

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
