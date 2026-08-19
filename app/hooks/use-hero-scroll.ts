import { useCallback, useSyncExternalStore } from "react";

const MOBILE_BREAKPOINT = 768;
const SCROLL_COLLAPSE_THRESHOLD = 100;
const SCROLL_EXPAND_THRESHOLD = 50;

let hasScrolled = false;
const scrollListeners = new Set<() => void>();

function emitScroll() {
  for (const listener of scrollListeners) {
    listener();
  }
}

function readHasScrolled(previous: boolean) {
  const scrollY = globalThis.scrollY ?? 0;

  return previous ? scrollY > SCROLL_EXPAND_THRESHOLD : scrollY > SCROLL_COLLAPSE_THRESHOLD;
}

function subscribeHeroScroll(onStoreChange: () => void) {
  if (scrollListeners.size === 0) {
    hasScrolled = readHasScrolled(false);
    globalThis.addEventListener("scroll", handleWindowScroll, { passive: true });
  }

  scrollListeners.add(onStoreChange);

  return () => {
    scrollListeners.delete(onStoreChange);

    if (scrollListeners.size === 0) {
      globalThis.removeEventListener("scroll", handleWindowScroll);
      hasScrolled = false;
    }
  };
}

function handleWindowScroll() {
  const next = readHasScrolled(hasScrolled);

  if (next === hasScrolled) {
    return;
  }

  hasScrolled = next;
  emitScroll();
}

function subscribeMobile(onStoreChange: () => void) {
  const media = globalThis.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
  media.addEventListener("change", onStoreChange);

  return () => media.removeEventListener("change", onStoreChange);
}

/**
 * Shared hero-collapse scroll and viewport state.
 *
 * hireApp used a root effect with 100px / 50px hysteresis so the header and
 * homepage stay in lockstep. This store is the reviewed external-DOM
 * replacement: one scroll listener, one matchMedia subscription.
 */
export function useHeroScroll(enabled = true) {
  const subscribeScroll = useCallback(
    (onStoreChange: () => void) => {
      if (!enabled) {
        return () => {};
      }

      return subscribeHeroScroll(onStoreChange);
    },
    [enabled],
  );

  const scrolled = useSyncExternalStore(
    subscribeScroll,
    () => enabled && hasScrolled,
    () => false,
  );

  const isMobile = useSyncExternalStore(
    subscribeMobile,
    () => globalThis.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`).matches,
    () => false,
  );

  return {
    hasScrolled: scrolled,
    isMobile,
    isDesktopCollapsed: enabled && scrolled && !isMobile,
    isMobileScrolled: enabled && scrolled && isMobile,
  };
}

export function getHeroHeightClasses(isDesktopCollapsed: boolean) {
  const desktopHeight = "md:h-[540px]";
  const containerClass =
    "relative top-0 right-0 left-0 z-40 h-auto py-6 md:fixed md:top-0 md:h-[540px] md:py-0";
  const heroOpacity = isDesktopCollapsed ? "md:pointer-events-none md:opacity-0" : "md:opacity-100";
  const contentTransform = isDesktopCollapsed
    ? "md:-translate-y-[440px] md:-mb-[440px]"
    : "md:translate-y-0";

  return { desktopHeight, containerClass, heroOpacity, contentTransform };
}
