import { useState, MouseEvent } from "react";

interface CarouselProps {
  images?: string[];
}

export default function Carousel({
  images = [
    "https://picsum.photos/seed/1/800/600",
    "https://picsum.photos/seed/2/800/600",
    "https://picsum.photos/seed/3/800/600",
  ],
}: CarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextSlide = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
  };

  const prevSlide = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    setCurrentIndex(
      (prevIndex) => (prevIndex - 1 + images.length) % images.length
    );
  };

  return (
    <div className="relative group overflow-hidden">
      <div
        className="flex transition-transform duration-300 ease-in-out"
        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
      >
        {images.map((image, index) => (
          <img
            key={index}
            src={image}
            alt={`Car view ${index + 1}`}
            className="w-full h-64 object-cover rounded flex-shrink-0"
          />
        ))}
      </div>
      <div className="absolute inset-0 flex items-center justify-between px-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <button
          onClick={prevSlide}
          className="bg-white bg-opacity-50 hover:bg-opacity-75 rounded-full h-10 w-10"
        >
          &#8592; {/* Left arrow */}
        </button>
        <button
          onClick={nextSlide}
          className="bg-white bg-opacity-50 hover:bg-opacity-75 rounded-full h-10 w-10"
        >
          &#8594; {/* Right arrow */}
        </button>
      </div>
    </div>
  );
}
