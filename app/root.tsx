import { Gift } from "lucide-react";
import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import {
  Await,
  Link,
  Links,
  type LinksFunction,
  type LoaderFunctionArgs,
  Meta,
  type MetaFunction,
  Outlet,
  Scripts,
  ScrollRestoration,
  data,
  isRouteErrorResponse,
  useLoaderData,
  useLocation,
  useOutletContext,
  useRouteError,
} from "react-router";
import { AuthenticityTokenProvider } from "remix-utils/csrf/react";
import tailwindStyles from "~/tailwind.css?url";
import { csrf } from "~/utils/csrf.server";
import { AISearchModal } from "./components/AISearchModal";
import { BookingSearch, BookingSearchDraftProvider } from "./components/BookingSearch";
import { CookieConsentBanner } from "./components/CookieConsentBanner";
import { MaintenancePage } from "./components/MaintenancePage";
import { ForbiddenPage, NotFoundPage, ServerErrorPage } from "./components/errors";
import { ProfileFormSheet } from "./components/forms/ProfileFormSheet";
import { Footer } from "./components/layout/Footer";
import { MobileBottomNav } from "./components/layout/MobileBottomNav";
import { UserNav } from "./components/layout/UserNav";
import { Button } from "./components/ui/button";
import { Toaster } from "./components/ui/toaster";
import {
  MOBILE_BREAKPOINT,
  SCROLL_COLLAPSE_THRESHOLD,
  SCROLL_EXPAND_THRESHOLD,
} from "./constants/ui";
import { COOKIE_CONSENT_KEY } from "./hooks/useCookieConsent";
import { cn, formatCurrency } from "./lib/utils";
import { getSessionUser } from "./modules/auth/auth.server";
import { touchSession } from "./modules/auth/session.server";
import { getReferralConfig } from "./services/referral.server";
import { generateMetaTags } from "./utils/seo";
import { env } from "./utils/server/env.server";
import { userHasRole } from "./utils/shared/roles";

// Type for outlet context - shared scroll state
export interface RootOutletContext {
  hasScrolled: boolean;
  isMobile: boolean;
}

// Hook to access scroll state from child routes
export function useRootScrollState() {
  return useOutletContext<RootOutletContext>();
}

// Constants
const AUTH_ROUTES = [
  "/auth",
  "/verify",
  "/admin/login",
  "/admin/verify",
  "/fleet-owner/login",
  "/fleet-owner/verify",
] as const;

// Hoisted static JSX elements (rendering-hoist-jsx)
const skipToMainLink = (
  <a
    href="#main-content"
    className="sr-only focus:not-sr-only focus:fixed focus:z-[100] focus:top-4 focus:left-4 focus:bg-white focus:text-black focus:px-3 focus:py-2 focus:rounded focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-black shadow"
  >
    Skip to main content
  </a>
);

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
 * Subscribe to cookie consent changes in localStorage
 * Uses useSyncExternalStore for proper React 18 external store subscription
 */
function getConsentSnapshot(): boolean {
  if (typeof globalThis === "undefined") return false;
  try {
    const stored = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!stored) return false;
    const parsed = JSON.parse(stored);
    return parsed.analytics === true;
  } catch {
    return false;
  }
}

function subscribeToConsent(callback: () => void): () => void {
  // Listen for storage changes (cross-tab)
  const handleStorage = (e: StorageEvent) => {
    if (e.key === COOKIE_CONSENT_KEY) {
      callback();
    }
  };
  globalThis.addEventListener("storage", handleStorage);

  // Also listen for custom event (same-tab updates)
  const handleCustom = () => callback();
  globalThis.addEventListener("cookie-consent-change", handleCustom);

  return () => {
    globalThis.removeEventListener("storage", handleStorage);
    globalThis.removeEventListener("cookie-consent-change", handleCustom);
  };
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * Defers analytics loading until after hydration to prevent Suspense
 * from affecting initial render/hydration of main content.
 * Only loads on Vercel deployments when user has consented to analytics cookies.
 */
function DeferredAnalytics() {
  const [shouldLoad, setShouldLoad] = useState(false);
  const hasAnalyticsConsent = useSyncExternalStore(
    subscribeToConsent,
    getConsentSnapshot,
    getServerSnapshot,
  );

  // Skip entirely on non-Vercel deployments - prevents lazy import
  const isVercel = import.meta.env.VITE_VERCEL === "1";

  useEffect(() => {
    // Only load on Vercel after hydration is complete and user has consented
    if (!isVercel || !hasAnalyticsConsent) return;

    const timeoutId = setTimeout(() => {
      setShouldLoad(true);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [hasAnalyticsConsent]);

  // Don't render anything on non-Vercel, before hydration, or without consent
  if (!isVercel || !shouldLoad || !hasAnalyticsConsent) {
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
  isFleetOwnerRoute: boolean,
): string => {
  if (isAuthPage || isHomePage) {
    return "";
  }
  if (isFleetOwnerRoute) {
    return "";
  }
  // md:pt-[69px] compensates for the fixed-position desktop header
  if (isCarDetailPage) {
    return "md:pt-[69px] lg:container lg:mx-auto lg:px-4";
  }
  return "md:pt-[69px] container mx-auto px-4";
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

export const meta: MetaFunction<typeof loader> = ({ loaderData }) => {
  const baseUrl = loaderData?.ENV?.DOMAIN ?? "http://localhost:5173";
  const appName = loaderData?.ENV?.APP_NAME ?? "Tripdly";

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
  const isMaintenanceMode = env.MAINTENANCE_MODE === "true";

  // Allow webhook/API routes through during maintenance
  const url = new URL(request.url);
  const isApiRoute = url.pathname.startsWith("/api/");

  if (isMaintenanceMode && !isApiRoute) {
    return data({
      maintenanceMode: true as const,
      user: null,
      ENV: {
        APP_NAME: env.APP_NAME,
        GOOGLE_MAPS_API_KEY: "",
        DOMAIN: env.DOMAIN,
        CLOUDFRONT_DOMAIN: "",
        isProduction: env.NODE_ENV === "production",
      },
      csrfToken: "",
      referralConfigPromise: Promise.resolve({
        REFERRAL_DISCOUNT_AMOUNT: 0,
        REFERRAL_DISCOUNT_PERCENT: 0,
        REFERRAL_MINIMUM_BOOKING_AMOUNT: 0,
      }),
    });
  }

  // Start non-blocking fetch immediately (Single Fetch streaming)
  // This promise will be streamed to the client after critical data is sent
  const referralConfigPromise = getReferralConfig();

  // Parallelize critical blocking operations (async-parallel)
  const [user, csrfResult, sessionCookie] = await Promise.all([
    getSessionUser(request),
    csrf.commitToken(request),
    touchSession(request),
  ]);

  const [csrfToken, csrfCookieHeader] = csrfResult;

  const ENV = {
    APP_NAME: env.APP_NAME,
    GOOGLE_MAPS_API_KEY: env.GOOGLE_MAPS_API_KEY,
    DOMAIN: env.DOMAIN,
    CLOUDFRONT_DOMAIN: env.CLOUDFRONT_DOMAIN,
    isProduction: env.NODE_ENV === "production",
  } as const;

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

  // Pass promise directly - Single Fetch will stream it after critical data
  return data(
    {
      maintenanceMode: false as const,
      user,
      ENV,
      csrfToken,
      referralConfigPromise,
    },
    { headers },
  );
}

function AppContent() {
  const { user, ENV, referralConfigPromise } = useLoaderData<typeof loader>();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const location = useLocation();

  // Route checks - simple string comparisons don't need memoization
  const isAuthPage = isAuthRoute(location.pathname);
  const isHomePage = location.pathname === "/";
  const partnerLandingMatch = /^\/partners\/([^/]+)\/?$/.exec(location.pathname);
  const isPartnerLandingPage = Boolean(partnerLandingMatch);
  const isHeroPage = isHomePage || isPartnerLandingPage;
  const partnerSlug = partnerLandingMatch?.[1] ?? null;
  const isCarDetailPage =
    location.pathname.startsWith("/cars/") || /^\/partners\/[^/]+\/cars\//.test(location.pathname);
  const isAdminRoute = location.pathname.startsWith("/admin");
  const isFleetOwnerRoute = location.pathname.startsWith("/fleet-owner");
  const isInternalDashboardRoute = isAdminRoute || isFleetOwnerRoute;

  // Computed values
  const dashboardLink = getDashboardLinkFromUser(user);

  const mainClassName = getMainClassName(isAuthPage, isHeroPage, isCarDetailPage, isFleetOwnerRoute);
  const showsFooter = !isAuthPage && !isInternalDashboardRoute;
  const mainPaddingClass = isCarDetailPage || showsFooter || isFleetOwnerRoute ? "pb-0" : "pb-20";
  const headerSearchBasePath = useMemo(() => {
    if (!partnerSlug) return "/search";
    try {
      return `/partners/${decodeURIComponent(partnerSlug).toLowerCase()}/search`;
    } catch {
      return `/partners/${partnerSlug.toLowerCase()}/search`;
    }
  }, [partnerSlug]);

  // Track scroll and mobile state for hero collapse
  // This state is shared with child routes via outlet context to prevent flash
  useEffect(() => {
    // Track mobile state
    const updateMobile = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    updateMobile();
    window.addEventListener("resize", updateMobile, { passive: true });

    if (!isHeroPage) {
      setHasScrolled(false);
      return () => window.removeEventListener("resize", updateMobile);
    }

    // Use hysteresis to prevent flicker when scrolling slowly near threshold
    // Collapse at 100px, expand at 50px - this creates a "dead zone" that prevents rapid toggling
    const handleScroll = () => {
      const scrollY = window.scrollY;
      setHasScrolled((prev) => {
        if (prev) {
          // Currently collapsed - only expand when scroll is below expand threshold
          return scrollY > SCROLL_EXPAND_THRESHOLD;
        }
        // Currently expanded - only collapse when scroll is above collapse threshold
        return scrollY > SCROLL_COLLAPSE_THRESHOLD;
      });
    };

    // Check initial state
    handleScroll();

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", updateMobile);
    };
  }, [isHeroPage]);

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
        {skipToMainLink}

        <BookingSearchDraftProvider>
          <div className="flex flex-col min-h-screen">
            {/* Desktop header - hidden on mobile, auth pages, and fleet-owner (has its own sidebar header) */}
            {/* On homepage: transparent overlay on hero, becomes solid on scroll */}
            {!isAuthPage && !isFleetOwnerRoute && (
              <header
                className={cn(
                  "hidden md:flex p-4 justify-between z-50 fixed top-0 left-0 right-0 transition-all duration-300",
                  isHeroPage && hasScrolled ? "items-start" : "items-center",
                  isHeroPage && !hasScrolled
                    ? "bg-transparent border-transparent"
                    : "bg-white border-b border-gray-200 shadow-sm",
                )}
              >
                <Link
                  to={dashboardLink}
                  className={`text-2xl md:text-3xl font-bold font-dancingscript transition-colors duration-300 shrink-0 ${
                    isHeroPage && !hasScrolled ? "text-white" : "text-gray-900"
                  }`}
                >
                  {ENV.APP_NAME}
                </Link>

                {/* Compact search in header - shown on hero pages when scrolled */}
                {isHeroPage && hasScrolled && (
                  <div className="flex-1 max-w-3xl mx-4 flex flex-col items-center gap-1">
                    <div className="w-full">
                      <BookingSearch
                        isCompact
                        navigateToSearch
                        searchBasePath={headerSearchBasePath}
                      />
                    </div>
                    <AISearchModal />
                  </div>
                )}

                <div className="flex items-center gap-2 mr-2 shrink-0">
                  {userHasRole(user, "user") && (
                    <Suspense fallback={null}>
                      <Await resolve={referralConfigPromise} errorElement={null}>
                        {(referralConfig) => (
                          <Button
                            variant="outline"
                            asChild
                            className={`text-sm transition-colors duration-300 ${
                              isHeroPage && !hasScrolled
                                ? "bg-white/20 border-white/40 text-white hover:bg-white/30"
                                : ""
                            }`}
                          >
                            <Link to="/referrals">
                              <span className="flex items-center gap-2">
                                Earn {formatCurrency(referralConfig.REFERRAL_DISCOUNT_AMOUNT)}
                                <Gift className="w-4 h-4 text-green-600 font-medium" />
                              </span>
                            </Link>
                          </Button>
                        )}
                      </Await>
                    </Suspense>
                  )}
                  <UserNav user={user} isTransparent={isHeroPage && !hasScrolled} />
                </div>
              </header>
            )}

            <main
              id="main-content"
              className={`flex-grow min-h-[500px] ${mainPaddingClass} md:pb-0 text-sm ${mainClassName}`}
            >
              <Outlet context={{ hasScrolled, isMobile } satisfies RootOutletContext} />
            </main>

            {/* Footer: hidden on auth pages, hidden on internal dashboard routes (admin/fleet-owner), hidden on mobile for car detail pages (booking flow has sticky footer) */}
            {!isAuthPage && !isInternalDashboardRoute && (
              <Footer isCarDetailPage={isCarDetailPage} appName={ENV.APP_NAME} />
            )}
          </div>
        </BookingSearchDraftProvider>

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

        {/* Lazy-load analytics components - deferred until after hydration and consent */}
        <DeferredAnalytics />

        {/* Cookie consent banner for NDPC compliance */}
        <CookieConsentBanner />
      </body>
    </html>
  );
}

export default function App() {
  const { csrfToken, maintenanceMode, ENV } = useLoaderData<typeof loader>();

  if (maintenanceMode) {
    return <MaintenancePage appName={ENV.APP_NAME} />;
  }

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
        (globalThis as unknown as Window & { ENV?: { APP_NAME?: string } }).ENV?.APP_NAME ??
        "Tripdly"
      );
    }
    // Server-side fallback (ErrorBoundary on server is rare)
    return "Tripdly";
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
