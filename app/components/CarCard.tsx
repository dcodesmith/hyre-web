import { Link } from "@remix-run/react";
import { Heart, Star } from "lucide-react";
import { formatCurrency } from "~/lib/utils";
import type { SerializedCar } from "~/types";
import Carousel from "./Carousel";

interface CarCardProps {
  readonly car: SerializedCar;
  readonly searchParams: URLSearchParams;
  readonly priority?: boolean;
  readonly price: number;
  readonly priceLabel?: string;
  readonly showTotal?: boolean;
  readonly totalPrice?: number;
  readonly variant?: "carousel" | "grid";
}

export function CarCard({
  car,
  searchParams,
  priority = false,
  price,
  priceLabel = "/ day",
  showTotal = false,
  totalPrice,
  variant = "carousel",
}: CarCardProps) {
  const isGrid = variant === "grid";

  return (
    <Link
      to={`/cars/${car.id}?${searchParams.toString()}`}
      className={isGrid ? "block" : "flex-shrink-0 w-[220px] md:w-[250px] snap-start"}
    >
      <div className="overflow-hidden space-y-3 group">
        <div className="relative">
          <Carousel
            images={car.images.length ? car.images.map(({ url }) => url) : undefined}
            priority={priority}
          />
          {/* Favorite Heart Icon - Airbnb style */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className="absolute top-3 right-3 p-2 bg-white/90 hover:bg-white rounded-full shadow-md transition-all"
            aria-label="Save to favorites"
          >
            <Heart className="h-4 w-4 text-gray-700" />
          </button>
        </div>

        <div className={isGrid ? "space-y-2" : "space-y-1.5"}>
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h3
                className={
                  isGrid
                    ? "text-base font-semibold group-hover:underline"
                    : "text-xs md:text-sm font-semibold group-hover:underline"
                }
              >
                {car.make} {car.model} ({car.year})
              </h3>
              <div className={isGrid ? "flex items-center gap-1 mt-1" : "flex items-center gap-1 mt-0.5"}>
                <Star
                  className={
                    isGrid
                      ? "h-4 w-4 text-gray-400 fill-gray-400"
                      : "h-2.5 md:h-3 w-2.5 md:w-3 text-gray-400 fill-gray-400"
                  }
                />
                <span className={isGrid ? "text-sm text-gray-600" : "text-[10px] md:text-xs text-gray-600"}>
                  New
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-baseline gap-1">
            {showTotal && totalPrice ? (
              <>
                <span
                  className={
                    isGrid ? "font-semibold text-lg" : "font-semibold text-sm md:text-base"
                  }
                >
                  {formatCurrency(totalPrice)}
                </span>
                <span className={isGrid ? "text-sm text-gray-600" : "text-[10px] md:text-xs text-gray-600"}>
                  total
                </span>
              </>
            ) : (
              <>
                <span
                  className={
                    isGrid ? "font-semibold text-lg" : "font-semibold text-sm md:text-base"
                  }
                >
                  {formatCurrency(price)}
                </span>
                <span className={isGrid ? "text-sm text-gray-600" : "text-[10px] md:text-xs text-gray-600"}>
                  {priceLabel}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
