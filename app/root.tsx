import { cssBundleHref } from "@remix-run/css-bundle";
import type { LinksFunction, LoaderFunctionArgs } from "@remix-run/node";
import {
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
  json,
  useLoaderData,
  useRouteError,
} from "@remix-run/react";
import tailwindStyles from "~/tailwind.css?url";
import Forbidden from "./components/Forbidden";
import { UserNav } from "./components/UserNav";
import { Toaster } from "./components/ui/toaster";
import { getSessionUser } from "./modules/auth/auth.server";
import { Button } from "./components/ui/button";

export const links: LinksFunction = () => [
  ...(cssBundleHref ? [{ rel: "stylesheet", href: cssBundleHref }] : []),
  { rel: "stylesheet", href: tailwindStyles },
  { rel: "icon", href: "/logo.svg" },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getSessionUser(request);

  const ENV = {
    APP_NAME: process.env.APP_NAME,
  };

  return json({
    user,
    ENV,
    // csrfToken,
  } as const);
}

export default function App() {
  const { user, ENV } = useLoaderData<typeof loader>();

  return (
    <html lang="en" className="h-full">
      <head>
        <title>{`${ENV.APP_NAME} - Effortless, Reliable, Safe, and Exceptional Service.`}</title>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="h-full bg-background">
        <div className="flex flex-col min-h-screen">
          <header className="p-4 flex container mx-auto justify-between items-center z-10">
            <Link
              to={
                user?.roles.some((role) => role.name === "admin")
                  ? "/admin"
                  : user?.roles.some((role) => role.name === "fleetOwner")
                    ? "/fleet-owner"
                    : "/"
              }
              className="text-2xl md:text-3xl font-bold font-dancingscript"
            >
              {ENV.APP_NAME}
            </Link>
            <div className="flex items-center gap-2 mr-2">
              {!user?.roles.some((role) => ["admin", "fleetOwner"].includes(role.name)) && (
                <Button variant="outline">Become a fleet owner</Button>
              )}
              <UserNav user={user} />
            </div>
          </header>

          <main className="flex-grow container mx-auto px-4 pb-4 text-sm">
            <Outlet />
          </main>

          <footer className="text-sm text-black py-4 text-center">
            © {new Date().getFullYear()} {ENV.APP_NAME}. All rights reserved.
          </footer>
        </div>

        <Toaster />

        <ScrollRestoration />
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: <framework pattern>
          dangerouslySetInnerHTML={{
            __html: `window.ENV = ${JSON.stringify(ENV)}`,
          }}
        />
        <Scripts />
      </body>
    </html>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error) && error.status === 403) {
    return <Forbidden />;
  }

  return (
    <html lang="en">
      <head>
        <title>Oh no!</title>
        <Meta />
        <Links />
      </head>
      <body>
        <main className="min-h-lvh">
          <div className="p-4">
            <Link to="/">&laquo; Back to Home</Link>
          </div>
          <div className="flex items-center justify-center">
            <p className="text-4xl font-bold">Something went wrong!</p>
            <p className="text-2xl font-bold">
              {error.status} - {error.statusText}
            </p>
          </div>
        </main>
        <Scripts />
      </body>
    </html>
  );
}
