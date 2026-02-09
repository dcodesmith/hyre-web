import { useState, useEffect, useCallback } from "react";

export const COOKIE_CONSENT_KEY = "tripdly-cookie-consent";

export type CookieConsent = {
  analytics: boolean;
  timestamp: number;
};

const defaultConsent: CookieConsent = {
  analytics: false,
  timestamp: 0,
};

/**
 * Hook to manage cookie consent state in localStorage
 * Returns null while loading to prevent hydration mismatch
 */
export function useCookieConsent() {
  const [consent, setConsent] = useState<CookieConsent | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load consent from localStorage on mount (client-side only)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(COOKIE_CONSENT_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (typeof parsed?.analytics === "boolean" && typeof parsed?.timestamp === "number") {
          setConsent(parsed as CookieConsent);
        }
      }
    } catch {
      // localStorage not available or invalid JSON
    }
    setIsLoaded(true);
  }, []);

  const updateConsent = useCallback((newConsent: Partial<CookieConsent>) => {
    const updated: CookieConsent = {
      ...defaultConsent,
      ...newConsent,
      timestamp: Date.now(),
    };

    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(updated));
      // Dispatch custom event for same-tab listeners (e.g., DeferredAnalytics)
      globalThis.dispatchEvent(new CustomEvent("cookie-consent-change"));
      setConsent(updated);
    } catch {
      // localStorage not available
    }
  }, []);

  const acceptAll = useCallback(() => {
    updateConsent({ analytics: true });
  }, [updateConsent]);

  const declineAll = useCallback(() => {
    updateConsent({ analytics: false });
  }, [updateConsent]);

  const hasConsented = consent !== null && consent.timestamp > 0;

  return {
    consent,
    isLoaded,
    hasConsented,
    setConsent: updateConsent,
    acceptAll,
    declineAll,
  };
}
