import { Outlet } from "react-router";

import { AuthLayout } from "~/auth/auth-layout";
import { CookieConsentBanner } from "~/components/cookie-consent-banner";

export default function AuthRouteLayout() {
  return (
    <>
      <a
        href="#main-content"
        className="fixed top-3 left-3 z-60 -translate-y-20 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg transition-transform focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 motion-reduce:transition-none"
      >
        Skip to main content
      </a>
      <AuthLayout>
        <Outlet />
      </AuthLayout>
      <CookieConsentBanner />
    </>
  );
}
