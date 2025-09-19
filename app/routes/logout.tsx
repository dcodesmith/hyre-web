import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { validateCSRF } from "~/utils/csrf-action.server";
import { authenticator } from "~/modules/auth/auth.server";
import { sessionStorage } from "~/modules/auth/session.server";
import logger from "~/lib/logger.server";

export const ROUTE_PATH = "/auth/logout" as const;

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    return await authenticator.logout(request, { redirectTo: "/" });
  } catch (error) {
    logger.warn("Error during logout (loader), force clearing session:", error);

    const session = await sessionStorage.getSession(request.headers.get("Cookie"));

    return redirect("/", {
      status: 303,
      headers: {
        "Set-Cookie": await sessionStorage.destroySession(session),
        "Cache-Control": "no-store",
      },
    });
  }
}

export async function action({ request }: ActionFunctionArgs) {
  await validateCSRF(request);

  try {
    return await authenticator.logout(request, { redirectTo: "/" });
  } catch (error) {
    logger.warn("Error during logout action, force clearing session:", error);

    const session = await sessionStorage.getSession(request.headers.get("Cookie"));

    return redirect("/", {
      status: 303,
      headers: {
        "Set-Cookie": await sessionStorage.destroySession(session),
        "Cache-Control": "no-store",
      },
    });
  }
}
