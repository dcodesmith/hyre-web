import { Outlet } from "react-router";

import { CookieConsentBanner } from "~/components/cookie-consent-banner";
import { PublicFooter } from "~/components/layout/public-footer";
import { PublicHeader } from "~/components/layout/public-header";
import { PublicMobileNav } from "~/components/layout/public-mobile-nav";

export default function PublicLayout() {
  return (
    <>
      <a
        href="#main-content"
        className="fixed top-3 left-3 z-60 -translate-y-20 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg transition-transform focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 motion-reduce:transition-none"
      >
        Skip to main content
      </a>
      <div className="flex min-h-screen flex-col">
        <PublicHeader />
        <main id="main-content" tabIndex={-1} className="min-h-125 flex-1 md:pt-17.25">
          <Outlet />
        </main>
        <PublicFooter />
      </div>
      <PublicMobileNav />
      <CookieConsentBanner />
    </>
  );
}
