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
  useLocation,
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
  // Performance optimizations
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  // Preload critical images for faster rendering
  { rel: "preload", href: "/images/hero.png", as: "image", type: "image/png" },
  // DNS prefetch for potential external resources
  { rel: "dns-prefetch", href: "https://vercel.app" },
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
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith("/admin");

  return (
    <html lang="en" className="h-full">
      <head>
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: <explanation>
          dangerouslySetInnerHTML={{
            __html: `
    (g=>{var h,a,k,p="The Google Maps JavaScript API",c="google",l="importLibrary",q="__ib__",m=document,b=window;b=b[c]||(b[c]={});var d=b.maps||(b.maps={}),r=new Set,e=new URLSearchParams,u=()=>h||(h=new Promise(async(f,n)=>{await (a=m.createElement("script"));e.set("libraries",[...r]+"");for(k in g)e.set(k.replace(/[A-Z]/g,t=>"_"+t.toLowerCase()),g[k]);e.set("callback",c+".maps."+q);a.src='https://maps.'+c+'apis.com/maps/api/js?'+e;d[q]=f;a.onerror=()=>h=n(Error(p+" could not load."));a.nonce=m.querySelector("script[nonce]")?.nonce||"";m.head.append(a)}));d[l]?console.warn(p+" only loads once. Ignoring:",g):d[l]=(f,...n)=>r.add(f)&&u().then(()=>d[l](f,...n))})({
        key: "AIzaSyC4wP-v71ZBOKNUXx8hOxmuYKdxY2gh0XM", // <-- **** REPLACE THIS WITH YOUR ACTUAL API KEY ****
        // Recommended: Use v=weekly or v=beta if your components require newer features
        v: "weekly"
        // No need for libraries=places here anymore, they get loaded via importLibrary
    });
    `,
          }}
        />

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
              {!isAdminRoute &&
                !user?.roles.some((role) =>
                  ["admin", "fleetOwner", "staff"].includes(role.name),
                ) && <Button variant="outline">Become a fleet owner</Button>}
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
