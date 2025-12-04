import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { auth } from "~/modules/auth/auth.server";

/**
 * Better-auth API handler route
 * This route handles all better-auth internal API requests
 * such as session management, token refresh, and other auth operations
 */
export async function loader({ request }: LoaderFunctionArgs) {
  return auth.handler(request);
}

export async function action({ request }: ActionFunctionArgs) {
  return auth.handler(request);
}

