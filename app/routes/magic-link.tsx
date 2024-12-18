import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticator } from "~/modules/auth/auth.server";

export const ROUTE_PATH = "/auth/magic-link" as const;

export async function loader({ request }: LoaderFunctionArgs) {
  return authenticator.authenticate("TOTP", request, {
    successRedirect: "/",
    failureRedirect: "/auth",
  });
}
