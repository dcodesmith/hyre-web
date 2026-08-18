import { Link } from "react-router";

import { Button } from "~/components/ui/button";
import { useCookieConsent } from "~/hooks/use-cookie-consent";

export function CookieConsentBanner() {
  const { isLoaded, hasConsented, acceptAll, declineAll } = useCookieConsent();

  if (!isLoaded || hasConsented) {
    return null;
  }

  return (
    <section
      aria-label="Cookie consent"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white p-4 shadow-lg md:right-auto md:bottom-4 md:left-4 md:max-w-md md:rounded-lg md:border"
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold text-gray-900">Cookie Preferences</h2>
          <p className="text-sm text-gray-600">
            We use essential cookies to keep the service working. You can also choose whether to
            allow analytics if they become available.{" "}
            <Link to="/cookies" className="text-primary hover:underline">
              Learn more
            </Link>
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
          <Button onClick={acceptAll} size="sm" className="w-full sm:flex-1">
            Accept All
          </Button>
          <Button onClick={declineAll} variant="outline" size="sm" className="w-full sm:flex-1">
            Essential Only
          </Button>
        </div>
      </div>
    </section>
  );
}
