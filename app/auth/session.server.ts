import { ApiRequestError } from "~/api/api.server";
import { getAuthSession } from "~/api/auth/auth.server";
import { hasSessionCookie } from "~/api/auth/cookie-relay.server";
import type { User } from "~/auth/user";

export async function readAuthSessionUser(request: Request) {
  if (!hasSessionCookie(request.headers.get("Cookie"))) {
    return null;
  }

  try {
    const session = await getAuthSession({ request });
    if (session == null) {
      return null;
    }

    const name = session.data.user.name?.trim();

    return {
      id: session.data.user.id,
      email: session.data.user.email,
      name: name || null,
      roles: session.data.user.roles,
    };
  } catch (error) {
    if (error instanceof ApiRequestError && error.kind === "http" && error.status === 401) {
      return null;
    }

    throw error;
  }
}

export async function readAuthUser(request: Request): Promise<User | null> {
  const user = await readAuthSessionUser(request);

  return user ? { email: user.email, name: user.name } : null;
}
