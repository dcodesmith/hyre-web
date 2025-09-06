import { MouseEvent, useState, useRef, TouchEvent } from "react";
import { Button } from "./ui/button";

interface CarouselProps {
  readonly images?: string[];
  readonly priority?: boolean; // Add priority prop for above-the-fold images
}

export default function Carousel({
  images = [
    "https://picsum.photos/seed/1/800/600",
    "https://picsum.photos/seed/2/800/600",
    "https://picsum.photos/seed/3/800/600",
  ],
  priority = false, // Default to lazy loading
}: CarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const nextSlide = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
  };

  const prevSlide = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    setCurrentIndex((prevIndex) => (prevIndex - 1 + images.length) % images.length);
  };

  const handleTouchStart = (event: TouchEvent) => {
    touchStartX.current = event.touches[0].clientX;
  };

  const handleTouchMove = (event: TouchEvent) => {
    touchEndX.current = event.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null) {
      return;
    }

    const distance = touchStartX.current - touchEndX.current;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
    }
    if (isRightSwipe) {
      setCurrentIndex((prevIndex) => (prevIndex - 1 + images.length) % images.length);
    }

    // Reset touch positions
    touchStartX.current = null;
    touchEndX.current = null;
  };

  return (
    <div
      className="relative group overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="flex transition-transform duration-300 ease-in-out"
        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
      >
        {images.map((image, index) => (
          <img
            key={image}
            src={image}
            alt={`Car view ${index + 1}`}
            className="w-full h-80 object-cover flex-shrink-0"
            width="400"
            height="320"
            loading={priority && index === 0 ? "eager" : "lazy"}
            decoding="async"
            // fetchPriority={priority && index === 0 ? "high" : "low"}
          />
        ))}
      </div>
      <div className="absolute inset-0 flex items-center justify-between px-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <Button
          onClick={prevSlide}
          className="bg-white bg-opacity-50 text-black hover:bg-white hover:bg-opacity-75 rounded-full h-10 w-10"
        >
          &#8592; {/* Left arrow */}
        </Button>
        <Button
          onClick={nextSlide}
          className="bg-white bg-opacity-50 text-black hover:bg-white hover:bg-opacity-75 rounded-full h-10 w-10"
        >
          &#8594; {/* Right arrow */}
        </Button>
      </div>
    </div>
  );
}
