import { useSyncExternalStore } from "react";

const COOKIE_CONSENT_KEY = "tripdly-cookie-consent:v1";
const LEGACY_COOKIE_CONSENT_KEY = "tripdly-cookie-consent";
const CONSENT_EVENT = "tripdly-cookie-consent-change";
const PENDING_SNAPSHOT = "__pending__";

type CookieConsent = {
  analytics: boolean;
  timestamp: number;
};

let memorySnapshot: string | null = null;

function readStoredConsent(): string | null {
  try {
    return (
      globalThis.localStorage.getItem(COOKIE_CONSENT_KEY) ??
      globalThis.localStorage.getItem(LEGACY_COOKIE_CONSENT_KEY) ??
      memorySnapshot
    );
  } catch {
    return memorySnapshot;
  }
}

function subscribe(onStoreChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === COOKIE_CONSENT_KEY || event.key === LEGACY_COOKIE_CONSENT_KEY) {
      onStoreChange();
    }
  };

  globalThis.addEventListener("storage", onStorage);
  globalThis.addEventListener(CONSENT_EVENT, onStoreChange);

  return () => {
    globalThis.removeEventListener("storage", onStorage);
    globalThis.removeEventListener(CONSENT_EVENT, onStoreChange);
  };
}

function parseConsent(snapshot: string | null): CookieConsent | null {
  if (!snapshot) {
    return null;
  }

  try {
    const value: unknown = JSON.parse(snapshot);
    if (
      typeof value === "object" &&
      value !== null &&
      "analytics" in value &&
      typeof value.analytics === "boolean" &&
      "timestamp" in value &&
      typeof value.timestamp === "number"
    ) {
      return value as CookieConsent;
    }
  } catch {
    // Invalid stored data is treated as no decision.
  }

  return null;
}

function saveConsent(analytics: boolean) {
  const serialized = JSON.stringify({ analytics, timestamp: Date.now() } satisfies CookieConsent);
  memorySnapshot = serialized;

  try {
    globalThis.localStorage.setItem(COOKIE_CONSENT_KEY, serialized);
    globalThis.localStorage.removeItem(LEGACY_COOKIE_CONSENT_KEY);
  } catch {
    // The in-memory snapshot still lets the current session continue.
  }

  globalThis.dispatchEvent(new Event(CONSENT_EVENT));
}

export function useCookieConsent() {
  const snapshot = useSyncExternalStore(subscribe, readStoredConsent, () => PENDING_SNAPSHOT);
  const isLoaded = snapshot !== PENDING_SNAPSHOT;
  const consent = isLoaded ? parseConsent(snapshot) : null;

  return {
    isLoaded,
    hasConsented: consent !== null && consent.timestamp > 0,
    acceptAll: () => saveConsent(true),
    declineAll: () => saveConsent(false),
  };
}
