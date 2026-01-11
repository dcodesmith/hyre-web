import { Link } from "@remix-run/react";
import { Sparkles } from "lucide-react";
import { formatCurrency } from "~/lib/utils";
import type { SerializedCar } from "~/types";
import { generateCarSlug } from "~/utils/seo";
import type { AggregatedRatings } from "~/services/reviews.server";
import Carousel from "./Carousel";
import { StarRating } from "./reviews/StarRating";

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
  readonly ratings?: AggregatedRatings;
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
  ratings,
}: CarCardProps) {
  const isGrid = variant === "grid";

  const carSlug = generateCarSlug({ id: car.id, make: car.make, model: car.model, year: car.year });

  const linkParams = new URLSearchParams(searchParams?.toString() || "");
  if (!linkParams.has("bookingType")) {
    linkParams.set("bookingType", "DAY");
  }
  const linkUrl = `/cars/${carSlug}?${linkParams.toString()}`;

  const carName = `${car.year} ${car.make} ${car.model}`;

  return (
    <Link
      to={linkUrl}
      className={isGrid ? "block" : "flex-shrink-0 w-[220px] md:w-[250px] snap-start"}
    >
      <div className="overflow-hidden space-y-3 group">
        <div className="relative">
          <Carousel
            images={car.images.length ? car.images.map(({ url }) => url) : undefined}
            variant={isGrid ? "grid" : "carousel"}
            priority={priority}
            carName={carName}
          />
          {/* New Listing Badge - only shows for cars added in last 7 days */}
          {isNewListing(car.createdAt) && (
            <div className="absolute top-3 left-3 px-2 py-1.5 bg-white/90 rounded-full shadow-md flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-amber-500" />
              <span className="text-xs font-medium text-gray-800 leading-none">New</span>
            </div>
          )}
          {/* Ratings display in top right corner */}
          {ratings && ratings.totalReviews > 0 && (
            <div className="absolute top-3 right-3 px-2 py-1.5 bg-white/90 hover:bg-white rounded-full shadow-md flex items-center gap-1.5 transition-all">
              <StarRating
                rating={ratings.averageRating}
                mode="compact"
                variant="black"
                size="sm"
                ariaLabel={`Average rating: ${ratings.averageRating.toFixed(1)} out of 5 stars`}
              />
              <span className="text-xs font-medium text-gray-700 leading-none">
                {ratings.averageRating.toFixed(1)} ({ratings.totalReviews})
              </span>
            </div>
          )}
        </div>

        <div className="space-y-0.5">
          <h3 className="text-sm font-semibold tracking-wider">
            {car.make} {car.model} ({car.year})
          </h3>

          <div className="flex text-xs items-center gap-1.5 text-gray-600">
            <span>{car.passengerCapacity}-Seater</span>
            {car.pricingIncludesFuel && (
              <>
                <span>•</span>
                <span>Fuel Included</span>
              </>
            )}
          </div>

          <div className="flex items-baseline gap-1">
            {showTotal && totalPrice ? (
              <>
                <span className="font-semibold text-sm">{formatCurrency(totalPrice)}</span>
                <span className="text-sm text-gray-600">total</span>
              </>
            ) : (
              <>
                <span className="font-semibold text-sm">{formatCurrency(price)}</span>
                <span className="text-sm text-gray-600">{priceLabel}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
