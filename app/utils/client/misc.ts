import { useRouteLoaderData } from "react-router";
import type { User } from "@prisma/client";

/**
 * Use root-loader data.
 */
export type RootLoaderData = {
  user: (User & { roles: { name: string }[] }) | null;
  ENV: {
    APP_NAME: string;
    GOOGLE_MAPS_API_KEY: string;
    CLOUDFRONT_DOMAIN: string;
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

// Re-export role utilities from shared module for backward compatibility
// New code should import directly from ~/utils/shared/roles
export type { RoleName } from "~/utils/shared/roles";
export { userHasRole } from "~/utils/shared/roles";
