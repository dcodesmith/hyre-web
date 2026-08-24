import type { AuthRole } from "~/api/auth/schema";
import { validReferralCode } from "~/auth/auth-form-schema";

const AUTH_ROLE_PATHS = {
  user: "/auth",
  fleetOwner: "/fleet-owner/login",
  admin: "/admin/login",
  staff: "/admin/login",
} as const satisfies Record<AuthRole, string>;

function hasUnsafeRedirectChars(value: string) {
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;

    if (character === "\\" || code < 32 || code === 127) {
      return true;
    }
  }

  return false;
}

export function authReferer(origin: string, role: AuthRole) {
  return `${new URL(origin).origin}${AUTH_ROLE_PATHS[role]}`;
}

export function safeRedirectPath(value: string | null | undefined, fallback = "/") {
  if (!value?.startsWith("/") || value.startsWith("//") || hasUnsafeRedirectChars(value)) {
    return fallback;
  }

  return value;
}

export function authPath(
  path: "/auth" | "/verify",
  query: { redirectTo?: string | null; ref?: string | null } = {},
) {
  const params = new URLSearchParams();
  const redirectTo = safeRedirectPath(query.redirectTo, "");

  if (redirectTo !== "" && redirectTo !== "/") {
    params.set("redirectTo", redirectTo);
  }

  if (path === "/auth") {
    const ref = validReferralCode(query.ref);

    if (ref) {
      params.set("ref", ref);
    }
  }

  const serialized = params.toString();
  return serialized ? `${path}?${serialized}` : path;
}
