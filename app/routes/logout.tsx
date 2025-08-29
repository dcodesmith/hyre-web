import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { sessionStorage } from "~/modules/auth/session.server";
import { validateCSRF } from "~/utils/csrf-action.server";

export const ROUTE_PATH = "/auth/logout" as const;

export async function loader({ request }: LoaderFunctionArgs) {
  return redirect("/");
}

export async function action({ request }: ActionFunctionArgs) {
  await validateCSRF(request);

  const session = await sessionStorage.getSession(request.headers.get("Cookie"));

  return redirect("/", {
    headers: {
      "Set-Cookie": await sessionStorage.destroySession(session),
    },
  });
}
