import { useEffect, useState } from "react";
import { MOBILE_BREAKPOINT, SCROLL_COLLAPSE_THRESHOLD } from "~/constants/ui";

interface HeroScrollState {
  /** Whether the desktop hero is collapsed (scrolled past threshold on desktop) */
  isDesktopCollapsed: boolean;
  /** Whether the mobile hero text is hidden (scrolled past threshold on mobile) */
  isMobileTextHidden: boolean;
}

/**
 * Hook to manage scroll-based hero section collapse behavior using Intersection Observer.
 * More performant than scroll listeners as it only fires when crossing thresholds,
 * rather than on every scroll event (60+ times/sec).
 * Handles both mobile (text only hidden) and desktop (full collapse) states.
 */
export function useHeroScroll(): HeroScrollState {
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);
  const [isMobileTextHidden, setIsMobileTextHidden] = useState(false);

  useEffect(() => {
    // Create an invisible sentinel element at the scroll threshold position
    // When this sentinel scrolls out of view, we know we've passed the threshold
    const sentinel = document.createElement("div");
    sentinel.setAttribute("aria-hidden", "true");
    sentinel.style.cssText = `
      position: absolute;
      top: ${SCROLL_COLLAPSE_THRESHOLD}px;
      left: 0;
      width: 1px;
      height: 1px;
      pointer-events: none;
    `;
    document.body.appendChild(sentinel);

    const updateCollapseState = (isScrolledPastThreshold: boolean) => {
      const isCurrentlyMobile = window.innerWidth < MOBILE_BREAKPOINT;
      const isCurrentlyDesktop = !isCurrentlyMobile;

      setIsDesktopCollapsed(isCurrentlyDesktop && isScrolledPastThreshold);
      setIsMobileTextHidden(isCurrentlyMobile && isScrolledPastThreshold);
    };

    // Intersection Observer fires only when sentinel crosses viewport boundary
    // Much more efficient than scroll listeners which fire continuously
    const observer = new IntersectionObserver(
      ([entry]) => {
        // When sentinel is NOT intersecting (scrolled past top), hero should collapse
        updateCollapseState(!entry.isIntersecting);
      },
      {
        root: null, // Observe relative to viewport
        rootMargin: "0px",
        threshold: 0,
      },
    );

    observer.observe(sentinel);

    // Handle resize for mobile/desktop breakpoint changes
    // This is still needed but fires much less frequently than scroll
    const handleResize = () => {
      const isScrolledPastThreshold = window.scrollY > SCROLL_COLLAPSE_THRESHOLD;
      updateCollapseState(isScrolledPastThreshold);
    };

    window.addEventListener("resize", handleResize, { passive: true });

    // Initial state check
    handleResize();

    return () => {
      observer.disconnect();
      sentinel.remove();
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return { isDesktopCollapsed, isMobileTextHidden };
}

/**
 * Generate hero container CSS classes based on scroll state
 * Mobile: h-[500px] expanded → h-[380px] collapsed
 * Desktop: md:h-[471px] expanded → md:h-[84px] collapsed
 */
export function getHeroHeightClasses(state: HeroScrollState): {
  mobileHeight: string;
  desktopHeight: string;
  containerClass: string;
} {
  const mobileHeight = state.isMobileTextHidden ? "h-[380px]" : "h-[500px]";
  const desktopHeight = state.isDesktopCollapsed ? "md:h-[84px]" : "md:h-[471px]";
  const containerClass = `fixed left-0 right-0 z-40 top-0 md:top-[69px] ${mobileHeight} ${desktopHeight}`;

  return { mobileHeight, desktopHeight, containerClass };
}
