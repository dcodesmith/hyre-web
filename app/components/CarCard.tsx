import { Link } from "@remix-run/react";
import { Heart, Sparkles } from "lucide-react";
import { formatCurrency } from "~/lib/utils";
import type { SerializedCar } from "~/types";
import Carousel from "./Carousel";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function isNewListing(createdAt: string): boolean {
  const createdDate = new Date(createdAt);
  const now = new Date();
  return now.getTime() - createdDate.getTime() < SEVEN_DAYS_MS;
}

interface CarCardProps {
  readonly car: SerializedCar;
  readonly searchParams?: URLSearchParams;
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
  const linkUrl = searchParams ? `/cars/${car.id}?${searchParams.toString()}` : `/cars/${car.id}`;

  return (
    <Link
      to={linkUrl}
      className={isGrid ? "block" : "flex-shrink-0 w-[220px] md:w-[250px] snap-start"}
    >
      <div className="overflow-hidden space-y-3 group">
        <div className="relative">
          <Carousel
            images={car.images.length ? car.images.map(({ url }) => url) : undefined}
            priority={priority}
          />
          {/* New Listing Badge - only shows for cars added in last 7 days */}
          {isNewListing(car.createdAt) && (
            <div className="absolute top-3 left-3 px-2.5 py-1.5 bg-white/90 rounded-full shadow-md flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-xs font-medium text-gray-800">New</span>
            </div>
          )}
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

        <div className="space-y-1">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h3 className="text-xs md:text-sm font-semibold tracking-wider">
                {car.make} {car.model} ({car.year})
              </h3>
            </div>
          </div>

          <div className="flex items-baseline gap-1">
            {showTotal && totalPrice ? (
              <>
                <span className="font-semibold text-xs md:text-sm">
                  {formatCurrency(totalPrice)}
                </span>
                <span className="text-xs md:text-sm text-gray-600">total</span>
              </>
            ) : (
              <>
                <span className="font-semibold text-xs md:text-sm">{formatCurrency(price)}</span>
                <span className="text-xs md:text-sm text-gray-600">{priceLabel}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
