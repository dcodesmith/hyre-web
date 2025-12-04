import { cssBundleHref } from "@remix-run/css-bundle";
import { type LinksFunction, type LoaderFunctionArgs, data } from "@remix-run/node";
import {
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
  useLoaderData,
  useLocation,
  useRouteError,
} from "@remix-run/react";
import { Analytics } from "@vercel/analytics/remix";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { useState } from "react";
import { AuthenticityTokenProvider } from "remix-utils/csrf/react";
import tailwindStyles from "~/tailwind.css?url";
import { csrf } from "~/utils/csrf.server";
import Forbidden from "./components/layout/Forbidden";
import { MobileBottomNav } from "./components/layout/MobileBottomNav";
import { UserNav } from "./components/layout/UserNav";
import { Toaster } from "./components/ui/toaster";
import { getSessionUser } from "./modules/auth/auth.server";
import { touchSession } from "./modules/auth/session.server";
import { env } from "./utils/server/env.server";
import { ProfileFormSheet } from "./components/forms/ProfileFormSheet";
import { userHasRole } from "./utils/shared/roles";
import { Button } from "./components/ui/button";
import { GiftIcon } from "@heroicons/react/24/outline";
import { getReferralConfig } from "./services/referral.server";
import { formatCurrency } from "./lib/utils";

export const links: LinksFunction = () => [
  ...(cssBundleHref ? [{ rel: "stylesheet", href: cssBundleHref }] : []),
  { rel: "stylesheet", href: tailwindStyles },
  { rel: "icon", href: "/favicon.ico" },
  // { rel: "icon", type: "image/svg+xml", href: "/logo.svg" },
  { rel: "alternate icon", href: "/favicon.ico" },
  { rel: "apple-touch-icon", href: "/apple-touch-icon.svg" },
  { rel: "apple-touch-icon-precomposed", href: "/apple-touch-icon.svg" },
  // Performance optimizations
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  // Preload critical fonts
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Nunito+Sans:ital,opsz,wght@0,6..12,200..1000;1,6..12,200..1000&display=swap",
  },
  // DNS prefetch for potential external resources
  { rel: "dns-prefetch", href: "https://vercel.app" },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getSessionUser(request);
  const [csrfToken, csrfCookieHeader] = await csrf.commitToken(request);

  const ENV = {
    APP_NAME: env.APP_NAME,
    GOOGLE_MAPS_API_KEY: env.GOOGLE_MAPS_API_KEY,
    DOMAIN: env.DOMAIN,
  };

  // Fetch referral config for the UI
  const referralConfig = await getReferralConfig();

  // Touch session to extend expiry (rolling expiry)
  const sessionCookie = await touchSession(request);

  // Properly handle multiple Set-Cookie headers
  const headers = new Headers();

  headers.set("Cache-Control", "private, no-store, must-revalidate");
  headers.append("Vary", "Cookie");

  if (csrfCookieHeader) {
    headers.append("Set-Cookie", csrfCookieHeader);
  }

  if (sessionCookie) {
    headers.append("Set-Cookie", sessionCookie);
  }

  return data(
    {
      user,
      ENV,
      csrfToken,
      referralDiscountAmount: referralConfig.REFERRAL_DISCOUNT_AMOUNT,
    },
    { headers },
  );
}

function AppContent() {
  const { user, ENV, referralDiscountAmount } = useLoaderData<typeof loader>();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const location = useLocation();

  const authRoutes = [
    "/auth",
    "/verify",
    "/admin/login",
    "/admin/verify",
    "/fleet-owner/login",
    "/fleet-owner/verify",
    "/fleet-owner/onboarding",
  ];
  const isAuthPage = authRoutes.some(
    (route) => location.pathname === route || location.pathname.startsWith(`${route}/`),
  );

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
        <Analytics />

        <div className="flex flex-col min-h-screen">
          {/* Desktop header - hidden on mobile and login/verify pages */}
          {!isAuthPage && (
            <header className="hidden md:flex p-4 container mx-auto justify-between items-center z-10">
              <Link
                to={
                  user?.roles?.some((role) => role.name === "admin")
                    ? "/admin"
                    : user?.roles?.some((role) => role.name === "fleetOwner")
                      ? "/fleet-owner"
                      : "/"
                }
                className="text-2xl md:text-3xl font-bold font-dancingscript"
              >
                {ENV.APP_NAME}
              </Link>
              <div className="flex items-center gap-2 mr-2">
                {userHasRole(user, "user") && (
                  <Button variant="outline" asChild className="text-sm">
                    <Link to="/referrals">
                      <span className="flex items-center gap-2">
                        Earn {formatCurrency(referralDiscountAmount)}
                        <GiftIcon className="w-4 h-4 text-green-600 font-medium" />
                      </span>
                    </Link>
                  </Button>
                )}
                <UserNav user={user} />
              </div>
            </header>
          )}

          <main
            className={`flex-grow ${isAuthPage ? "" : "container mx-auto px-4"} pb-20 md:pb-4 text-sm`}
          >
            <Outlet />
          </main>

          {!isAuthPage && (
            <footer className="text-sm text-black py-4 text-center">
              © {new Date().getFullYear()} {ENV.APP_NAME}. All rights reserved.
            </footer>
          )}
        </div>

        {/* Mobile bottom navigation - hidden on login/verify pages */}
        {!isAuthPage && (
          <MobileBottomNav
            user={user}
            appName={ENV.APP_NAME}
            onProfileOpen={() => setIsProfileOpen(true)}
          />
        )}

        {/* Mobile profile sheet */}
        <div className="md:hidden">
          <ProfileFormSheet open={isProfileOpen} onOpenChange={setIsProfileOpen} user={user} />
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

        {/* Load Google Maps asynchronously */}
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: <framework pattern>
          dangerouslySetInnerHTML={{
            __html: `
              (g=>{var h,a,k,p="The Google Maps JavaScript API",c="google",l="importLibrary",q="__ib__",m=document,b=window;b=b[c]||(b[c]={});var d=b.maps||(b.maps={}),r=new Set,e=new URLSearchParams,u=()=>h||(h=new Promise(async(f,n)=>{await (a=m.createElement("script"));e.set("libraries",[...r]+"");for(k in g)e.set(k.replace(/[A-Z]/g,t=>"_"+t.toLowerCase()),g[k]);e.set("callback",c+".maps."+q);a.src='https://maps.'+c+'apis.com/maps/api/js?'+e;d[q]=f;a.onerror=()=>h=n(Error(p+" could not load."));a.nonce=m.querySelector("script[nonce]")?.nonce||"";m.head.append(a)}));d[l]?console.warn(p+" only loads once. Ignoring:",g):d[l]=(f,...n)=>r.add(f)&&u().then(()=>d[l](f,...n))})({
                key: ${JSON.stringify(ENV.GOOGLE_MAPS_API_KEY)},
                v: "weekly"
              });
            `,
          }}
        />
        {/* Fallback Google Maps loading */}
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: <framework pattern>
          dangerouslySetInnerHTML={{
            __html: `
              // Fallback: ensure Google Maps is loaded
              setTimeout(function() {
                if (!window.google?.maps?.importLibrary) {
                  console.log('Loading Google Maps via fallback method');
                  const script = document.createElement('script');
                  const key = encodeURIComponent(window.ENV?.GOOGLE_MAPS_API_KEY ?? '');
                  script.src = 'https://maps.googleapis.com/maps/api/js?key=' + key + '&libraries=places&v=weekly';
                  script.async = true;
                  script.defer = true;
                  document.head.appendChild(script);
                }
              }, 2000);
            `,
          }}
        />
        <SpeedInsights />
      </body>
    </html>
  );
}

export default function App() {
  const { csrfToken } = useLoaderData<typeof loader>();

  return (
    <AuthenticityTokenProvider token={csrfToken}>
      <AppContent />
    </AuthenticityTokenProvider>
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
            {isRouteErrorResponse(error) && (
              <p className="text-2xl font-bold">
                {error.status} - {error.statusText}
              </p>
            )}
          </div>
        </main>
        <Scripts />
      </body>
    </html>
  );
}
