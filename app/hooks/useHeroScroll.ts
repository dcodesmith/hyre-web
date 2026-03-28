import { useEffect, useState } from "react";
import { MOBILE_BREAKPOINT, SCROLL_COLLAPSE_THRESHOLD } from "~/constants/ui";

interface HeroScrollState {
  /** Whether the desktop hero is collapsed (scrolled past threshold on desktop) */
  isDesktopCollapsed: boolean;
  /** Whether mobile scroll has passed hero threshold (hides text, shows compact search) */
  isMobileScrolled: boolean;
}

/**
 * Hook to manage scroll-based hero section collapse behavior using Intersection Observer.
 * More performant than scroll listeners as it only fires when crossing thresholds,
 * rather than on every scroll event (60+ times/sec).
 * Handles both mobile (text only hidden) and desktop (full collapse) states.
 */
export function useHeroScroll(): HeroScrollState {
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);
  const [isMobileScrolled, setIsMobileScrolled] = useState(false);

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
      setIsMobileScrolled(isCurrentlyMobile && isScrolledPastThreshold);
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
    // Use requestAnimationFrame to batch layout reads and avoid forced reflows
    let rafId: number | null = null;
    const handleResize = () => {
      // Cancel any pending RAF to avoid multiple reflows
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }

      // Schedule layout reads in the next frame to batch with other layout reads
      rafId = requestAnimationFrame(() => {
        const isScrolledPastThreshold = window.scrollY > SCROLL_COLLAPSE_THRESHOLD;
        updateCollapseState(isScrolledPastThreshold);
        rafId = null;
      });
    };

    window.addEventListener("resize", handleResize, { passive: true });

    // Initial state check
    handleResize();

    return () => {
      observer.disconnect();
      sentinel.remove();
      window.removeEventListener("resize", handleResize);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, []);

  return { isDesktopCollapsed, isMobileScrolled };
}

/**
 * Generate hero container CSS classes based on scroll state
 * Mobile: relative positioning, natural scroll (h-auto)
 * Desktop expanded: starts at top-0 (behind transparent header), h-[540px]
 * Desktop collapsed: height 0 (search moves to header)
 */
export function getHeroHeightClasses(state: HeroScrollState): {
  mobileHeight: string;
  desktopHeight: string;
  containerClass: string;
  heroOpacity: string;
  contentTransform: string;
} {
  const mobileHeight = "h-auto py-6";
  // Spacer is always 540px - no layout shift on collapse
  const desktopHeight = "md:h-[540px]";
  // Hero is always 540px height but uses opacity to hide when collapsed (no layout shift)
  const containerClass = `relative md:fixed left-0 right-0 z-40 top-0 md:top-0 md:py-0 md:h-[540px] ${mobileHeight}`;
  // Use opacity instead of height to hide hero - prevents layout shift
  const heroOpacity = state.isDesktopCollapsed
    ? "md:opacity-0 md:pointer-events-none"
    : "md:opacity-100";
  // Move content up when collapsed via transform (no layout shift, just visual repositioning).
  // Negative margin-bottom compensates because transforms don't shrink the layout box,
  // which would otherwise leave equal whitespace above the footer.
  const contentTransform = state.isDesktopCollapsed
    ? "md:-translate-y-[440px] md:-mb-[440px]"
    : "md:translate-y-0";

  return { mobileHeight, desktopHeight, containerClass, heroOpacity, contentTransform };
}
