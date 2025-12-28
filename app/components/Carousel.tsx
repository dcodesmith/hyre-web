import { MouseEvent, useState, useRef, TouchEvent } from "react";
import { Button } from "./ui/button";
import { cn } from "~/lib/utils";
import { MoveLeft, MoveRight } from "lucide-react";
import { getOptimizedImageUrl, getImageSrcSet } from "~/utils/image-optimization";

interface CarouselProps {
  readonly images?: string[];
  readonly variant?: "carousel" | "booking";
  readonly priority?: boolean;
}

export default function Carousel({
  variant = "carousel",
  images = [
    "https://picsum.photos/seed/1/800/600",
    "https://picsum.photos/seed/2/800/600",
    "https://picsum.photos/seed/3/800/600",
  ],
  priority = false,
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
        {images.map((image, index) => (
          <img
            key={image}
            src={getOptimizedImageUrl(image, { width: 640 })}
            srcSet={getImageSrcSet(image, 640)}
            sizes="(max-width: 768px) 100vw, 640px"
            alt={`Car view ${index + 1}`}
            className="w-full h-72 md:h-80 object-cover flex-shrink-0"
            width="640"
            height="320"
            loading={priority && index === 0 ? "eager" : "lazy"}
            fetchPriority={priority && index === 0 ? "high" : "auto"}
            decoding="async"
            draggable={false}
          />
        ))}
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

      {/* Dot indicators */}
      <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 flex space-x-1.5">
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
