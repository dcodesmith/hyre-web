import { useCallback, useEffect, useRef, useState } from "react";

interface UseCarouselScrollOptions {
  /**
   * Dependencies that should trigger a scroll state check
   */
  readonly dependencies?: unknown[];
}

/**
 * Custom hook for carousel scroll functionality
 * Handles scroll state tracking and smooth scrolling
 */
export function useCarouselScroll(options: UseCarouselScrollOptions = {}) {
  const { dependencies = [] } = options;
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);

  // Optimize scroll check using requestAnimationFrame to batch layout reads
  const checkScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Cancel any pending RAF to avoid multiple reflows
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    // Schedule layout read in the next frame
    rafRef.current = requestAnimationFrame(() => {
      setCanScrollLeft(container.scrollLeft > 0);
      setCanScrollRight(container.scrollLeft < container.scrollWidth - container.clientWidth - 10);
    });
  }, []);

  // Check initial scroll state after mount and when dependencies change
  useEffect(() => {
    checkScroll();

    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);

  const scroll = useCallback(
    (direction: "left" | "right") => {
      const container = scrollContainerRef.current;
      if (!container) return;

      // Read layout property once and cache it
      const scrollAmount = container.clientWidth * 0.8; // Scroll 80% of container width
      const newScrollLeft =
        direction === "left"
          ? container.scrollLeft - scrollAmount
          : container.scrollLeft + scrollAmount;

      container.scrollTo({
        left: newScrollLeft,
        behavior: "smooth",
      });

      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      scrollTimeoutRef.current = setTimeout(checkScroll, 300);
    },
    [checkScroll],
  );

  return {
    scrollContainerRef,
    canScrollLeft,
    canScrollRight,
    scroll,
    checkScroll,
  };
}
