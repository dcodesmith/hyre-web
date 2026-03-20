import { type LoaderFunctionArgs } from "react-router";

/**
 * Splat route to catch all unmatched routes and throw a 404 error.
 * This ensures that any URL that doesn't match a defined route
 * will properly trigger the ErrorBoundary with a 404 status.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);

  throw new Response(`Page not found: ${url.pathname}`, {
    status: 404,
    statusText: "Not Found",
  });
}

export default function CatchAllRoute() {
  // This component will never render because the loader always throws
  return null;
}
