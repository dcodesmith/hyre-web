import { MouseEvent, useState, useRef, TouchEvent, useMemo } from "react";
import { Button } from "./ui/button";
import { cn } from "~/lib/utils";
import { MoveLeft, MoveRight } from "lucide-react";
import { getOptimizedImageUrl, getImageSrcSet } from "~/utils/image-optimization";

interface CarouselProps {
  readonly images?: string[];
  readonly variant?: "carousel" | "booking" | "grid";
  readonly priority?: boolean;
  /** Car name for SEO-friendly alt text (e.g., "2023 Toyota Camry") */
  readonly carName?: string;
}

const VARIANT_DIMENSIONS = {
  carousel: { baseWidth: 220, sizesAttr: "(max-width: 640px) 220px, 250px" },
  grid: {
    baseWidth: 380,
    sizesAttr:
      "(max-width: 640px) calc(100vw - 2rem), (max-width: 1024px) calc(50vw - 1.5rem), 400px",
  },
  booking: {
    baseWidth: 412,
    sizesAttr: "(max-width: 768px) 100vw, (max-width: 1024px) 80vw, 691px",
  },
} as const;

/**
 * Calculates the optimal base width and sizes attribute for responsive images
 * based on the carousel variant.
 *
 * Mobile-first approach: baseWidth matches mobile display size to optimize
 * image download size. The sizes attribute tells the browser what size to expect
 * at different breakpoints, allowing it to select the best image from srcSet.
 *
 * Image size selection (browser picks from srcSet based on display size × DPR):
 * - Carousel variant (baseWidth 220px, srcSet: 320w, 400w, 440w, 480w, 640w):
 *   • Mobile 220px @ 1x DPR: selects 320w (220px × 1 = 220px needed)
 *   • Mobile 220px @ 2x DPR: selects 440w (220px × 2 = 440px needed)
 *   • Desktop 250px @ 1x DPR: selects 320w (250px × 1 = 250px needed)
 *   • Desktop 250px @ 2x DPR: selects 640w (250px × 2 = 500px needed)
 *
 * - Grid variant (baseWidth 380px, srcSet: 400w, 640w, 800w):
 *   • Mobile 380px @ 1x DPR: selects 400w (380px × 1 = 380px needed)
 *   • Mobile 380px @ 2x DPR: selects 800w (380px × 2 = 760px needed)
 *   • Desktop 400px @ 1x DPR: selects 400w (400px × 1 = 400px needed)
 *   • Desktop 400px @ 2x DPR: selects 800w (400px × 2 = 800px needed)
 *
 * - Booking variant (baseWidth 412px, srcSet: 480w, 640w, 1024w):
 *   • Mobile 412px @ 1x DPR: selects 480w (412px × 1 = 412px needed)
 *   • Mobile 412px @ 2x DPR: selects 1024w (412px × 2 = 824px needed)
 *   • Desktop 691px @ 1x DPR: selects 1024w (691px × 1 = 691px needed)
 *   • Desktop 691px @ 2x DPR: selects 1024w (691px × 2 = 1382px needed, uses largest available)
 *
 * @param variant - The carousel variant: "carousel" (home page), "grid" (search page), or "booking" (car detail page)
 * @returns Object with baseWidth (number) and sizesAttr (string)
 */
function getImageDimensions(variant: "carousel" | "booking" | "grid"): {
  baseWidth: number;
  sizesAttr: string;
} {
  return VARIANT_DIMENSIONS[variant];
}

export default function Carousel({
  variant = "carousel",
  images = [
    "https://picsum.photos/seed/1/800/600",
    "https://picsum.photos/seed/2/800/600",
    "https://picsum.photos/seed/3/800/600",
  ],
  priority = false,
  carName,
}: CarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const startTime = useRef<number | null>(null);

  const nextSlide = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setCurrentIndex((prevIndex) => (prevIndex < images.length - 1 ? prevIndex + 1 : prevIndex));
  };

  const prevSlide = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setCurrentIndex((prevIndex) => (prevIndex > 0 ? prevIndex - 1 : prevIndex));
  };

  const handleTouchStart = (event: TouchEvent) => {
    touchStartX.current = event.touches[0].clientX;
    touchEndX.current = null;
    startTime.current = Date.now();
    setIsDragging(true);
    setDragOffset(0);
  };

  const handleTouchMove = (event: TouchEvent) => {
    if (event.touches.length !== 1 || touchStartX.current === null) {
      return;
    }

    touchEndX.current = event.touches[0].clientX;
    const currentDragOffset = touchEndX.current - touchStartX.current;

    // Limit drag offset to prevent over-scrolling
    const maxDragOffset = 100;
    const limitedOffset = Math.max(-maxDragOffset, Math.min(maxDragOffset, currentDragOffset));

    setDragOffset(limitedOffset);
  };

  const resetTouchState = () => {
    touchStartX.current = null;
    touchEndX.current = null;
    startTime.current = null;
    setIsDragging(false);
    setDragOffset(0);
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null || startTime.current === null) {
      resetTouchState();
      return;
    }

    const distance = touchStartX.current - touchEndX.current;
    const durationMs = Math.max(1, Date.now() - startTime.current);
    const velocity = Math.abs(distance) / durationMs; // pixels per ms

    // More sensitive swipe detection: smaller distance threshold or high velocity
    const isLeftSwipe = distance > 30 || (distance > 10 && velocity > 0.3);
    const isRightSwipe = distance < -30 || (distance < -10 && velocity > 0.3);

    if (isLeftSwipe && currentIndex < images.length - 1) {
      setCurrentIndex((prevIndex) => prevIndex + 1);
    }
    if (isRightSwipe && currentIndex > 0) {
      setCurrentIndex((prevIndex) => prevIndex - 1);
    }

    // Reset all touch state
    resetTouchState();
  };

  const handleTouchCancel = () => resetTouchState();

  // Calculate image dimensions once based on variant (memoized to avoid recalculation)
  const { baseWidth, sizesAttr } = useMemo(() => getImageDimensions(variant), [variant]);

  return (
    <div
      aria-label="Car images"
      aria-roledescription="Carousel"
      className={cn(
        "relative group overflow-hidden touch-pan-y select-none rounded-xl",
        variant === "booking" && "rounded-t-none md:rounded-xl",
      )}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
    >
      <div
        className={`flex will-change-transform ${isDragging ? "transition-none" : "transition-transform duration-200 ease-out"}`}
        style={{
          transform: `translateX(calc(-${currentIndex * 100}% + ${dragOffset}px))`,
        }}
      >
        {images.map((image, index) => {
          const altText = carName
            ? `${carName} - Image ${index + 1} of ${images.length}`
            : `Car image ${index + 1} of ${images.length}`;
          return (
            <img
              key={image}
              src={getOptimizedImageUrl(image, { width: baseWidth })}
              srcSet={getImageSrcSet(image, baseWidth)}
              sizes={sizesAttr}
              alt={altText}
              className="w-full aspect-[4/3] object-cover flex-shrink-0"
              width={baseWidth}
              height={Math.round(baseWidth * 0.75)}
              loading={priority && index === 0 ? "eager" : "lazy"}
              fetchPriority={priority && index === 0 ? "high" : "auto"}
              decoding="async"
              draggable={false}
            />
          );
        })}
      </div>

      {/* Navigation arrows */}
      <div className="absolute inset-0 items-center justify-between px-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 hidden md:flex">
        <Button
          type="button"
          aria-label="Previous slide"
          onClick={prevSlide}
          className="bg-white/90 text-black hover:bg-white rounded-full h-8 w-8 p-0 disabled:opacity-25 disabled:cursor-not-allowed shadow-md"
          disabled={currentIndex === 0}
        >
          <MoveLeft className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          aria-label="Next slide"
          onClick={nextSlide}
          className="bg-white/90 text-black hover:bg-white rounded-full h-8 w-8 p-0 disabled:opacity-25 disabled:cursor-not-allowed shadow-md"
          disabled={currentIndex === images.length - 1}
        >
          <MoveRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Slide counter */}
      <div
        className="absolute right-3 bottom-3 bg-black/70 text-white px-2 py-1 rounded-md text-xs font-medium"
        aria-live="polite"
      >
        {currentIndex + 1} / {images.length}
      </div>

      {/* Dot indicators - hidden on mobile since slide counter is visible */}
      <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 hidden md:flex space-x-1.5">
        {images.map((image, index) => (
          <button
            key={`slide-indicator-${image}`}
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setCurrentIndex(index);
            }}
            className={cn(
              "w-1.5 h-1.5 rounded-full transition-all",
              index === currentIndex ? "bg-white w-6 cursor-not-allowed" : "bg-white/60",
            )}
            aria-label={`Go to slide ${index + 1}`}
            aria-roledescription="Slide indicator"
            aria-current={index === currentIndex ? "true" : undefined}
            disabled={index === currentIndex}
            title={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
