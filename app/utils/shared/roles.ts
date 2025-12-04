/**
 * Role names in the system.
 * Implementation based on github.com/epicweb-dev/epic-stack
 */
export type RoleName = "user" | "fleetOwner" | "admin" | "chauffeur" | "staff";

/**
 * Type for a user with roles - works in both client and server contexts
 */
export type UserWithRoles = {
  roles: { name: string }[];
};

/**
 * Check if a user has a specific role.
 * Works in both client and server contexts.
 */
export function userHasRole(user: UserWithRoles | null | undefined, roleName: RoleName): boolean {
  if (!user) {
    return false;
  }

  return user.roles.some((role) => role.name === roleName);
}
