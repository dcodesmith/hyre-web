import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticator } from "~/modules/auth/auth.server";

// import { ROUTE_PATH as DASHBOARD_PATH } from "#app/routes/dashboard+/_layout";
// import { ROUTE_PATH as LOGIN_PATH } from "#app/routes/auth+/login";

export const ROUTE_PATH = "/auth/magic-link" as const;

export async function loader({ request }: LoaderFunctionArgs) {
  return authenticator.authenticate("TOTP", request, {
    successRedirect: "/",
    failureRedirect: "/login",
  });
}
