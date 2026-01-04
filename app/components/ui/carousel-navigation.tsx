import { ChevronLeft, ChevronRight } from "lucide-react";

interface CarouselNavigationProps {
  readonly onScrollLeft: () => void;
  readonly onScrollRight: () => void;
  readonly canScrollLeft: boolean;
  readonly canScrollRight: boolean;
}

/**
 * Reusable carousel navigation buttons
 */
export function CarouselNavigation({
  onScrollLeft,
  onScrollRight,
  canScrollLeft,
  canScrollRight,
}: CarouselNavigationProps) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={onScrollLeft}
        disabled={!canScrollLeft}
        className="p-1.5 md:p-2 border border-gray-300 rounded-full hover:border-gray-900 hover:shadow-md transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-gray-300 disabled:hover:shadow-none"
        aria-label="Scroll left"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onScrollRight}
        disabled={!canScrollRight}
        className="p-1.5 md:p-2 border border-gray-300 rounded-full hover:border-gray-900 hover:shadow-md transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-gray-300 disabled:hover:shadow-none"
        aria-label="Scroll right"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

