import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { validateCSRF } from "~/utils/csrf-action.server";
import { auth } from "~/modules/auth/auth.server";
import logger from "~/lib/logger.server";

export const ROUTE_PATH = "/auth/logout" as const;

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const signOutResponse = await auth.api.signOut({
      headers: request.headers,
      asResponse: true,
    });

    const betterAuthCookie = signOutResponse.headers.get("Set-Cookie");

    const headers = new Headers();
    headers.set("Cache-Control", "no-store");
    if (betterAuthCookie) {
      headers.set("Set-Cookie", betterAuthCookie);
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

  try {
    const signOutResponse = await auth.api.signOut({
      headers: request.headers,
      asResponse: true,
    });

    const betterAuthCookie = signOutResponse.headers.get("Set-Cookie");

    const headers = new Headers();
    headers.set("Cache-Control", "no-store");
    if (betterAuthCookie) {
      headers.set("Set-Cookie", betterAuthCookie);
    }

    return redirect("/", { headers });
  } catch (error) {
    logger.warn("Error during logout action:", error);
    return redirect("/", {
      status: 303,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  }
}
