import { Link } from "@remix-run/react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

interface CarouselSectionProps {
  readonly title: string;
  readonly href?: string;
  readonly id?: string;
  readonly children: ReactNode;
}

export function CarouselSection({ title, href = "#", id, children }: CarouselSectionProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  const checkScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    setCanScrollLeft(container.scrollLeft > 0);
    setCanScrollRight(container.scrollLeft < container.scrollWidth - container.clientWidth - 10);
  };

  const scroll = (direction: "left" | "right") => {
    const container = scrollContainerRef.current;
    if (!container) return;

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
  };

  return (
    <section id={id} className="relative max-w-[1400px] mx-auto px-6 md:px-8 scroll-mt-20">
      {/* Header */}
      <div className="mb-4">
        <div className="flex justify-between items-center">
          <Link to={href} className="group inline-flex items-center gap-2">
            <h2 className="text-lg md:text-[20px] font-semibold group-hover:underline">{title}</h2>
            <span className="inline-flex items-center justify-center h-8 w-8 border border-input bg-background rounded-full p-1.5 group-hover:border-gray-900 transition-colors">
              <ArrowRight className="h-4 w-4" />
            </span>
          </Link>

          {/* Navigation Arrows - All Views */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => scroll("left")}
              disabled={!canScrollLeft}
              className="p-1.5 md:p-2 border border-gray-300 rounded-full hover:border-gray-900 hover:shadow-md transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-gray-300 disabled:hover:shadow-none"
              aria-label="Scroll left"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => scroll("right")}
              disabled={!canScrollRight}
              className="p-1.5 md:p-2 border border-gray-300 rounded-full hover:border-gray-900 hover:shadow-md transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-gray-300 disabled:hover:shadow-none"
              aria-label="Scroll right"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div
        ref={scrollContainerRef}
        onScroll={checkScroll}
        className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide scroll-smooth gap-4 md:gap-6 pb-2"
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {children}
      </div>
    </section>
  );
}
