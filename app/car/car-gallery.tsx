import { MoveLeft, MoveRight } from "lucide-react";
import { type MouseEvent, type TouchEvent, useRef, useState } from "react";

import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

interface CarGalleryProps {
  readonly images: readonly string[];
  readonly carName: string;
  readonly priority?: boolean;
}

const BOOKING_IMAGE_WIDTH = 412;
const BOOKING_IMAGE_HEIGHT = Math.round(BOOKING_IMAGE_WIDTH * 0.75);
const BOOKING_IMAGE_SIZES = "(max-width: 768px) 100vw, (max-width: 1024px) 80vw, 691px";

export function CarGallery({ images, carName, priority = false }: CarGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const startTime = useRef<number | null>(null);
  const imageCount = images.length;
  const canNavigate = imageCount > 1;

  const showPrevious = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setCurrentIndex((index) => (index > 0 ? index - 1 : index));
  };

  const showNext = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setCurrentIndex((index) => (index < imageCount - 1 ? index + 1 : index));
  };

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
    touchEndX.current = null;
    startTime.current = Date.now();
    setIsDragging(true);
    setDragOffset(0);
  };

  const handleTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 1 || touchStartX.current === null) {
      return;
    }

    const currentX = event.touches[0]?.clientX;
    if (currentX === undefined) {
      return;
    }

    touchEndX.current = currentX;
    const currentDragOffset = currentX - touchStartX.current;
    const maxDragOffset = 100;
    setDragOffset(Math.max(-maxDragOffset, Math.min(maxDragOffset, currentDragOffset)));
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
    const velocity = Math.abs(distance) / durationMs;
    const isLeftSwipe = distance > 30 || (distance > 10 && velocity > 0.3);
    const isRightSwipe = distance < -30 || (distance < -10 && velocity > 0.3);

    if (isLeftSwipe && currentIndex < imageCount - 1) {
      setCurrentIndex((index) => index + 1);
    }

    if (isRightSwipe && currentIndex > 0) {
      setCurrentIndex((index) => index - 1);
    }

    resetTouchState();
  };

  if (imageCount === 0) {
    return (
      <div className="flex aspect-4/3 items-center justify-center bg-gray-100 text-sm text-gray-500">
        Image unavailable
      </div>
    );
  }

  return (
    <section
      aria-label="Car images"
      aria-roledescription="Carousel"
      className="relative group overflow-hidden touch-pan-y select-none rounded-xl rounded-t-none md:rounded-xl"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={resetTouchState}
    >
      <div
        className={cn(
          "flex will-change-transform",
          isDragging
            ? "transition-none"
            : "transition-transform duration-200 ease-out motion-reduce:transition-none",
        )}
        style={{
          transform: `translateX(calc(-${currentIndex * 100}% + ${dragOffset}px))`,
        }}
      >
        {images.map((image, index) => (
          <img
            key={image}
            src={image}
            alt={`${carName}, ${index + 1} of ${imageCount}`}
            className="w-full aspect-4/3 object-cover shrink-0"
            width={BOOKING_IMAGE_WIDTH}
            height={BOOKING_IMAGE_HEIGHT}
            sizes={BOOKING_IMAGE_SIZES}
            loading={priority && index === 0 ? "eager" : "lazy"}
            fetchPriority={priority && index === 0 ? "high" : "auto"}
            decoding="async"
            draggable={false}
          />
        ))}
      </div>

      {canNavigate ? (
        <div className="absolute inset-0 items-center justify-between px-4 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-300 hidden md:flex">
          <Button
            type="button"
            aria-label="Previous slide"
            onClick={showPrevious}
            disabled={currentIndex === 0}
            className="bg-white/90 text-black hover:bg-white rounded-full h-8 w-8 p-0 disabled:opacity-25 disabled:cursor-not-allowed shadow-md"
          >
            <MoveLeft aria-hidden="true" className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            aria-label="Next slide"
            onClick={showNext}
            disabled={currentIndex === imageCount - 1}
            className="bg-white/90 text-black hover:bg-white rounded-full h-8 w-8 p-0 disabled:opacity-25 disabled:cursor-not-allowed shadow-md"
          >
            <MoveRight aria-hidden="true" className="h-4 w-4" />
          </Button>
        </div>
      ) : null}

      <div
        className="absolute right-3 bottom-3 bg-black/70 text-white px-2 py-1 rounded-md text-xs font-medium"
        aria-live="polite"
      >
        {currentIndex + 1} / {imageCount}
      </div>

      {canNavigate ? (
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
                "h-1.5 w-1.5 rounded-full transition-[width,background-color] motion-reduce:transition-none",
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
      ) : null}
    </section>
  );
}
