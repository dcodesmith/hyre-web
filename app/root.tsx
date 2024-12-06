import { cssBundleHref } from "@remix-run/css-bundle";
import type { LinksFunction, LoaderFunctionArgs } from "@remix-run/node";
import {
  json,
  Link,
  Links,
  // LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from "@remix-run/react";
import tailwindStyles from "~/tailwind.css?url";
import { Toaster } from "./components/ui/toaster";
import { UserNav } from "./components/UserNav";
import { authenticator } from "./modules/auth/auth.server";
import { prisma } from "./modules/db/db.server";

export const links: LinksFunction = () => [
  ...(cssBundleHref ? [{ rel: "stylesheet", href: cssBundleHref }] : []),
  { rel: "stylesheet", href: tailwindStyles, as: "style" },
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
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="h-full bg-background">
        <div className="flex flex-col min-h-screen">
          <header className="p-4 flex container mx-auto justify-between items-center sticky top-0 bg-white z-10">
            <Link
              to="/"
              className="text-2xl font-bold font-dancingscript text-slate-600"
            >
              {ENV.APP_NAME}
            </Link>
            <UserNav user={user} />
          </header>

          <main className="flex-grow container mx-auto px-4 py-4 text-sm">
            <Outlet />
          </main>

          <footer className="text-sm text-black py-4 text-center">
            © {new Date().getFullYear()} {ENV.APP_NAME}. All rights reserved.
          </footer>
        </div>

        <Toaster />

        <ScrollRestoration />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.ENV = ${JSON.stringify(ENV)}`,
          }}
        />
        <Scripts />
        {/* {process.env.NODE_ENV === "development" && <LiveReload />} */}

        {/* {location.pathname === "/login" && <Login />} */}
        {/* {searchParams.get("login") === "true" && <Login />} */}
      </body>
    </html>
  );
}
