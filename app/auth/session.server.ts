import { ApiRequestError } from "~/api/api.server";
import { getAuthSession } from "~/api/auth/auth.server";
import { hasSessionCookie } from "~/api/auth/cookie-relay.server";
import type { User } from "~/auth/user";

export async function readAuthUser(request: Request): Promise<User | null> {
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
      email: session.data.user.email,
      name: name || null,
    };
  } catch (error) {
    if (
      error instanceof ApiRequestError &&
      error.kind === "http" &&
      (error.status === 401 || error.status === 403)
    ) {
      return null;
    }

    throw error;
  }
}
