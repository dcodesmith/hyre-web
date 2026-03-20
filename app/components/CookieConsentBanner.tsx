import { Link } from "react-router";
import { Button } from "~/components/ui/button";
import { useCookieConsent } from "~/hooks/useCookieConsent";

/**
 * Cookie consent banner for NDPC compliance
 * Only shows when user hasn't made a choice yet
 * Allows accepting or declining analytics cookies
 */
export function CookieConsentBanner() {
  const { isLoaded, hasConsented, acceptAll, declineAll } = useCookieConsent();

  // Don't render during SSR or before localStorage is checked
  if (!isLoaded) {
    return null;
  }

  // Don't show if user has already made a choice
  if (hasConsented) {
    return null;
  }

  return (
    <section
      aria-label="Cookie consent"
      aria-live="polite"
      className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-white border-t border-gray-200 shadow-lg md:bottom-4 md:left-4 md:right-auto md:max-w-md md:rounded-lg md:border"
    >
      <div className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-gray-900">Cookie Preferences</h2>
          <p className="text-sm text-gray-600">
            We use cookies to improve your experience and analyze site usage.{" "}
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
