import { ApiRequestError } from "~/api/api.server";
import { getAuthSession } from "~/api/auth/auth.server";
import { hasSessionCookie } from "~/api/auth/cookie-relay.server";

export async function readAuthUser(request: Request): Promise<boolean> {
  if (!hasSessionCookie(request.headers.get("Cookie"))) {
    return false;
  }

  try {
    const session = await getAuthSession({ request });
    return session != null;
  } catch (error) {
    if (error instanceof ApiRequestError && error.kind === "aborted") {
      throw error;
    }

    return false;
  }
}
