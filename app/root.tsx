import { cssBundleHref } from "@remix-run/css-bundle";
import {
  type LinksFunction,
  type LoaderFunctionArgs,
  type MetaFunction,
  data,
} from "@remix-run/node";
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
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { AuthenticityTokenProvider } from "remix-utils/csrf/react";
import tailwindStyles from "~/tailwind.css?url";
import { csrf } from "~/utils/csrf.server";
import { ForbiddenPage, NotFoundPage, ServerErrorPage } from "./components/errors";
import { Footer } from "./components/layout/Footer";
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
import { generateMetaTags } from "./utils/seo";

// Constants
const AUTH_ROUTES = [
  "/auth",
  "/verify",
  "/admin/login",
  "/admin/verify",
  "/fleet-owner/login",
  "/fleet-owner/verify",
] as const;

const GOOGLE_FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Nunito+Sans:ital,opsz,wght@0,6..12,200..1000;1,6..12,200..1000&family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&display=swap";

const ERROR_STATUS = {
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  SERVER_ERROR: 500,
} as const;

// Lazy-load analytics components for code splitting
const LazyAnalytics = lazy(() =>
  import("./components/AnalyticsWrapper").then((mod) => ({
    default: mod.AnalyticsWrapper,
  })),
);

/**
 * Defers analytics loading until after hydration to prevent Suspense
 * from affecting initial render/hydration of main content
 */
function DeferredAnalytics() {
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    // Defer loading until after hydration is complete
    // Using requestIdleCallback for better performance, with setTimeout fallback
    const timeoutId = setTimeout(() => {
      setShouldLoad(true);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
    };
  }, []);

  if (!shouldLoad) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <LazyAnalytics />
    </Suspense>
  );
}

// Helper functions
const isAuthRoute = (pathname: string): boolean => {
  return AUTH_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
};

const getDashboardLinkFromUser = (user: Awaited<ReturnType<typeof getSessionUser>>): string => {
  if (user?.roles?.some((role) => role.name === "admin")) {
    return "/admin";
  }
  if (user?.roles?.some((role) => role.name === "fleetOwner")) {
    return "/fleet-owner";
  }
  return "/";
};

const getMainClassName = (
  isAuthPage: boolean,
  isHomePage: boolean,
  isCarDetailPage: boolean,
): string => {
  if (isAuthPage || isHomePage) {
    return "";
  }
  if (isCarDetailPage) {
    return "lg:container lg:mx-auto lg:px-4";
  }
  return "container mx-auto px-4";
};

const getErrorDetails = (
  error: unknown,
): { status: number; statusText: string; message: string } => {
  if (isRouteErrorResponse(error)) {
    return {
      status: error.status,
      statusText: error.statusText,
      message: typeof error.data === "string" ? error.data : JSON.stringify(error.data),
    };
  }
  if (error instanceof Error) {
    return {
      status: ERROR_STATUS.SERVER_ERROR,
      statusText: "Internal Server Error",
      message: error.message,
    };
  }
  return {
    status: ERROR_STATUS.SERVER_ERROR,
    statusText: "Unknown Error",
    message: "An unexpected error occurred",
  };
};

const getPageTitle = (error: unknown): string => {
  if (isRouteErrorResponse(error)) {
    if (error.status === ERROR_STATUS.NOT_FOUND) return "Page Not Found";
    if (error.status === ERROR_STATUS.FORBIDDEN) return "Access Denied";
    if (error.status >= ERROR_STATUS.SERVER_ERROR) return "Server Error";
  }
  return "Error";
};

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const baseUrl = data?.ENV?.DOMAIN ?? "http://localhost:5173";
  const appName = data?.ENV?.APP_NAME ?? "Tripdly";

  return generateMetaTags({
    title: `${appName} - Effortless, Reliable, Safe, and Exceptional Service.`,
    description:
      "Premium chauffeur service in Nigeria. Book luxury vehicles with professional drivers for day trips, airport pickups, and special events. Safe, reliable, and exceptional service.",
    url: baseUrl,
    image: `${baseUrl}/og-image.jpg`,
  });
};

export const links: LinksFunction = () => {
  const linksArray = [
    ...(cssBundleHref ? [{ rel: "stylesheet" as const, href: cssBundleHref }] : []),
    // Preload critical Tailwind CSS to reduce blocking time
    { rel: "preload" as const, href: tailwindStyles, as: "style" as const },
    { rel: "stylesheet" as const, href: tailwindStyles },
    { rel: "icon" as const, href: "/favicon.ico" },
    { rel: "alternate icon" as const, href: "/favicon.ico" },
    { rel: "apple-touch-icon" as const, href: "/apple-touch-icon.svg" },
    {
      rel: "apple-touch-icon-precomposed" as const,
      href: "/apple-touch-icon.svg",
    },
    // Performance optimizations - preconnect early
    { rel: "preconnect" as const, href: "https://fonts.googleapis.com" },
    {
      rel: "preconnect" as const,
      href: "https://fonts.gstatic.com",
      crossOrigin: "anonymous" as const,
    },
    // Preload Google Fonts CSS to avoid CLS (matches async-loaded stylesheet)
    {
      rel: "preload" as const,
      href: GOOGLE_FONTS_URL,
      as: "style" as const,
    },
    // DNS prefetch for Vercel and Analytics
    { rel: "dns-prefetch" as const, href: "https://vercel.app" },
    {
      rel: "dns-prefetch" as const,
      href: "https://vitals.vercel-insights.com",
    },
  ];

  return linksArray;
};

export async function loader({ request }: LoaderFunctionArgs) {
  // Parallelize independent operations to reduce blocking time
  const [user, csrfResult, referralConfig] = await Promise.all([
    getSessionUser(request),
    csrf.commitToken(request),
    getReferralConfig(),
  ]);

  const [csrfToken, csrfCookieHeader] = csrfResult;

  const ENV = {
    APP_NAME: env.APP_NAME,
    GOOGLE_MAPS_API_KEY: env.GOOGLE_MAPS_API_KEY,
    DOMAIN: env.DOMAIN,
    CLOUDFRONT_DOMAIN: env.CLOUDFRONT_DOMAIN,
  } as const;

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

  // Route checks - simple string comparisons don't need memoization
  const isAuthPage = isAuthRoute(location.pathname);
  const isHomePage = location.pathname === "/";
  const isCarDetailPage = location.pathname.startsWith("/cars/");
  const isAdminRoute = location.pathname.startsWith("/admin");
  const isFleetOwnerRoute = location.pathname.startsWith("/fleet-owner");
  const isInternalDashboardRoute = isAdminRoute || isFleetOwnerRoute;

  // Computed values
  const dashboardLink = getDashboardLinkFromUser(user);
  const mainClassName = getMainClassName(isAuthPage, isHomePage, isCarDetailPage);
  const mainPaddingClass = isCarDetailPage ? "pb-0" : "pb-20";

  // Memoize callbacks passed to child components
  const handleProfileOpen = useCallback(() => {
    setIsProfileOpen(true);
  }, []);

  const handleProfileOpenChange = useCallback((open: boolean) => {
    setIsProfileOpen(open);
  }, []);

  return (
    <html lang="en" className="h-full">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="h-full bg-background">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:z-[100] focus:top-4 focus:left-4 focus:bg-white focus:text-black focus:px-3 focus:py-2 focus:rounded focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-black shadow"
        >
          Skip to main content
        </a>

        <div className="flex flex-col min-h-screen">
          {/* Desktop header - hidden on mobile and login/verify pages */}
          {!isAuthPage && (
            <header className="hidden md:flex p-4 justify-between items-center z-50 sticky top-0 bg-white backdrop-blur-sm border-b border-transparent transition-all">
              <Link
                to={dashboardLink}
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
            id="main-content"
            className={`flex-grow ${mainPaddingClass} md:pb-0 text-sm ${mainClassName}`}
          >
            <Outlet />
          </main>

          {/* Footer: hidden on auth pages, hidden on internal dashboard routes (admin/fleet-owner), hidden on mobile for car detail pages (booking flow has sticky footer) */}
          {!isAuthPage && !isInternalDashboardRoute && (
            <div className={isCarDetailPage ? "hidden lg:block lg:mt-10" : ""}>
              <Footer appName={ENV.APP_NAME} />
            </div>
          )}
        </div>

        {/* Mobile bottom navigation - hidden on login/verify pages */}
        {!isAuthPage && (
          <MobileBottomNav user={user} appName={ENV.APP_NAME} onProfileOpen={handleProfileOpen} />
        )}

        {/* Mobile profile sheet */}
        <div className="md:hidden">
          <ProfileFormSheet
            open={isProfileOpen}
            onOpenChange={handleProfileOpenChange}
            user={user}
          />
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

        {/* Load Google Fonts asynchronously after hydration to avoid blocking render */}
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: <performance optimization>
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = '${GOOGLE_FONTS_URL}';
                document.head.appendChild(link);
              })();
            `,
          }}
        />
        {/* Fallback for no-JS: load fonts synchronously */}
        <noscript>
          <link rel="stylesheet" href={GOOGLE_FONTS_URL} />
        </noscript>

        {/* Lazy-load analytics components - deferred until after hydration */}
        <DeferredAnalytics />
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
  const isDevelopment = process.env.NODE_ENV === "development";

  // Memoize app name - works on both server and client
  // Note: On client, window.ENV is set by loader script tag
  // On server (rare for ErrorBoundary), use generic fallback
  const appName = useMemo(() => {
    if (globalThis.window !== undefined) {
      return (
        (globalThis as unknown as Window & { ENV?: { APP_NAME?: string } }).ENV?.APP_NAME ?? "App"
      );
    }
    // Server-side fallback (ErrorBoundary on server is rare)
    return "App";
  }, []);

  // Memoize error details
  const errorDetails = useMemo(() => getErrorDetails(error), [error]);

  // Memoize page title
  const pageTitle = useMemo(() => getPageTitle(error), [error]);

  // Memoize error page render
  const errorPage = useMemo(() => {
    if (isRouteErrorResponse(error)) {
      if (error.status === ERROR_STATUS.FORBIDDEN) {
        return <ForbiddenPage appName={appName} />;
      }
      if (error.status === ERROR_STATUS.NOT_FOUND) {
        return <NotFoundPage appName={appName} />;
      }
    }
    // For 500 errors and other unexpected errors
    return <ServerErrorPage error={errorDetails} showDetails={isDevelopment} />;
  }, [error, appName, errorDetails, isDevelopment]);

  return (
    <html lang="en" className="h-full">
      <head>
        <title>{`${pageTitle} | ${appName}`}</title>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="h-full bg-background">
        {errorPage}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
