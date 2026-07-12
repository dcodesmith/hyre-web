import { type ActionFunctionArgs, type LoaderFunctionArgs, redirect } from "react-router";
import { validateCSRF } from "~/utils/csrf-action.server";
import { auth } from "~/modules/auth/auth.server";
import logger from "~/lib/logger.server";
import { safeRedirect } from "~/utils/safe-redirect";

export const ROUTE_PATH = "/auth/logout" as const;

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const signOutResponse = await auth.api.signOut({
      headers: request.headers,
      asResponse: true,
    });

    const headers = new Headers();
    headers.set("Cache-Control", "no-store");
    // getSetCookie keeps each clearing cookie as its own header; a joined
    // string would only clear the session token, leaving the cache cookie alive
    for (const cookie of signOutResponse.headers.getSetCookie()) {
      headers.append("Set-Cookie", cookie);
    }

    return redirect("/", { headers });
  } catch (error) {
    logger.warn("Error during logout (loader):", error);
    return redirect("/", {
      status: 303,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  }
}

export async function action({ request }: ActionFunctionArgs) {
  await validateCSRF(request);

  const formData = await request.clone().formData();
  const redirectTo = safeRedirect(formData.get("redirectTo"), "/");

  try {
    const signOutResponse = await auth.api.signOut({
      headers: request.headers,
      asResponse: true,
    });

    const headers = new Headers();
    headers.set("Cache-Control", "no-store");
    for (const cookie of signOutResponse.headers.getSetCookie()) {
      headers.append("Set-Cookie", cookie);
    }

    return redirect(redirectTo, { headers });
  } catch (error) {
    logger.warn("Error during logout action:", error);
    return redirect(redirectTo, {
      status: 303,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  }
}
