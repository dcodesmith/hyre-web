import { Link } from "@remix-run/react";
import { ArrowRight } from "lucide-react";
import { useCallback, type ReactNode } from "react";
import { CarouselNavigation } from "./ui/carousel-navigation";
import { useCarouselScroll } from "~/hooks/useCarouselScroll";

interface CarouselSectionProps {
  readonly title: string;
  readonly href?: string;
  readonly id?: string;
  readonly children: ReactNode;
}

export function CarouselSection({ title, href = "#", id, children }: CarouselSectionProps) {
  const { scrollContainerRef, canScrollLeft, canScrollRight, scroll, checkScroll } =
    useCarouselScroll();

  const handleScrollLeft = useCallback(() => scroll("left"), [scroll]);
  const handleScrollRight = useCallback(() => scroll("right"), [scroll]);

  return (
    <section id={id} className="relative max-w-[1400px] mx-auto px-6 md:px-8 scroll-mt-20">
      {/* Header */}
      <div className="mb-4">
        <div className="flex justify-between items-center">
          <Link to={href} className="group inline-flex items-center gap-2">
            <h2 className="text-lg md:text-xl font-semibold group-hover:underline">{title}</h2>
            <span className="inline-flex items-center justify-center h-8 w-8 border border-input bg-background rounded-full p-1.5 group-hover:border-gray-900 transition-colors">
              <ArrowRight className="h-4 w-4" />
            </span>
          </Link>

          {/* Navigation Arrows - All Views */}
          <CarouselNavigation
            onScrollLeft={handleScrollLeft}
            onScrollRight={handleScrollRight}
            canScrollLeft={canScrollLeft}
            canScrollRight={canScrollRight}
          />
        </div>
      </div>

      {/* Scrollable Content */}
      <div
        ref={scrollContainerRef}
        onScroll={checkScroll}
        className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide scroll-smooth gap-4 md:gap-6"
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
