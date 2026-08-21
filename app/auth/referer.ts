import type { AuthRole } from "~/api/auth/schema";

export const AUTH_ROLE_PATHS = {
  user: "/auth",
  fleetOwner: "/fleet-owner/login",
  admin: "/admin/login",
  staff: "/admin/login",
} as const satisfies Record<AuthRole, string>;

export function authReferer(origin: string, role: AuthRole) {
  return `${new URL(origin).origin}${AUTH_ROLE_PATHS[role]}`;
}

export function safeRedirectPath(value: string | null | undefined, fallback = "/") {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }

  return value;
}
