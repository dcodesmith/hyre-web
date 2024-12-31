import { cssBundleHref } from "@remix-run/css-bundle";
import type { LinksFunction, LoaderFunctionArgs } from "@remix-run/node";
import {
  Link,
  Links,
  // LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  json,
  useLoaderData,
  useRouteError,
} from "@remix-run/react";
import tailwindStyles from "~/tailwind.css?url";
import { UserNav } from "./components/UserNav";
import { Toaster } from "./components/ui/toaster";
import { authenticator } from "./modules/auth/auth.server";
import { prisma } from "./modules/db/db.server";

export const links: LinksFunction = () => [
  ...(cssBundleHref ? [{ rel: "stylesheet", href: cssBundleHref }] : []),
  { rel: "stylesheet", href: tailwindStyles },
  { rel: "icon", href: "/logo.svg" },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const sessionUser = await authenticator.isAuthenticated(request);
  const user = sessionUser?.id
    ? await prisma.user.findUnique({
        where: { id: sessionUser.id },
        include: { roles: { select: { name: true } } },
      })
    : null;

  // const locale = await i18nServer.getLocale(request)
  // const { toast, headers: toastHeaders } = await getToastSession(request)
  // const [csrfToken, csrfCookieHeader] = await csrf.commitToken();

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
          <header className="p-4 flex container mx-auto justify-between items-center sticky top-0 bg-white z-20">
            <Link to="/" className="text-2xl font-bold font-dancingscript text-slate-600">
              {ENV.APP_NAME}
            </Link>
            <UserNav user={user} />
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
            <p className="text-4xl font-bold">Yawa dey o!</p>
          </div>
        </main>
        <Scripts />
      </body>
    </html>
  );
}
