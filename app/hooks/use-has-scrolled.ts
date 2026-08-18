import { useCallback, useSyncExternalStore } from "react";

const SCROLL_THRESHOLD = 8;

/**
 * Tracks whether the window has scrolled past a small threshold.
 *
 * External DOM synchronization is isolated here via `useSyncExternalStore` so
 * consumers stay render-only. Pass `enabled = false` to skip subscribing when a
 * page never needs the scroll state (keeps the listener off unrelated routes).
 */
export function useHasScrolled(enabled = true) {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (!enabled) {
        return () => {};
      }

      globalThis.addEventListener("scroll", onStoreChange, { passive: true });

      return () => globalThis.removeEventListener("scroll", onStoreChange);
    },
    [enabled],
  );

  const getSnapshot = useCallback(
    () => enabled && globalThis.scrollY > SCROLL_THRESHOLD,
    [enabled],
  );

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
