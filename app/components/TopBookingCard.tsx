import { Link } from "@remix-run/react";
import { formatCurrency } from "~/lib/utils";
import type { SerializedCar } from "~/types";
import { generateCarSlug } from "~/utils/seo";
import type { AggregatedRatings } from "~/services/reviews.server";
import { getOptimizedImageUrl } from "~/utils/image-optimization";
import { StarRating } from "./reviews/StarRating";

/** Minimum rating to be considered a "Top Booking" */
export const TOP_BOOKING_MIN_RATING = 4.5;

interface TopBookingCardProps {
  readonly car: SerializedCar;
  readonly searchParams?: URLSearchParams;
  readonly priority?: boolean;
  readonly price: number;
  readonly ratings: AggregatedRatings;
}

/**
 * Filters cars to only include those with 4.5+ star ratings
 * @param cars - Array of cars to filter
 * @param ratings - Record of car ID to ratings
 * @returns Cars with 4.5+ average rating, sorted by rating descending
 */
export function filterTopBookings(
  cars: SerializedCar[],
  ratings: Record<string, AggregatedRatings>,
): { car: SerializedCar; ratings: AggregatedRatings }[] {
  return cars
    .filter((car) => {
      const carRatings = ratings[car.id];
      return (
        carRatings &&
        carRatings.totalReviews > 0 &&
        carRatings.averageRating >= TOP_BOOKING_MIN_RATING
      );
    })
    .map((car) => ({ car, ratings: ratings[car.id] }))
    .sort((a, b) => b.ratings.averageRating - a.ratings.averageRating);
}

/**
 * Horizontal card for "Top Bookings" carousel
 * Layout: Text on left, image on right, 260px height
 * Only renders cars with 4.5+ star ratings
 */
export function TopBookingCard({
  car,
  searchParams,
  priority = false,
  price,
  ratings,
}: TopBookingCardProps) {
  const carSlug = generateCarSlug({ id: car.id, make: car.make, model: car.model, year: car.year });

  const linkParams = new URLSearchParams(searchParams?.toString() || "");
  if (!linkParams.has("bookingType")) {
    linkParams.set("bookingType", "DAY");
  }
  const linkUrl = `/cars/${carSlug}?${linkParams.toString()}`;

  const carName = `${car.year} ${car.make} ${car.model}`;
  const imageUrl = car.images[0]?.url;

  return (
    <Link to={linkUrl} className="flex-shrink-0 w-[220px] md:w-[250px] snap-start group">
      <div className="relative h-[96px] bg-white rounded-xl overflow-hidden shadow-sm border border-stone-200 hover:shadow-md transition-shadow">
        <div className="flex h-full">
          <div className="flex-1 text-sm p-3 flex flex-col justify-between min-w-0">
            <div>
              <h3 className="font-semibold leading-tight line-clamp-1">
                {car.make} {car.model}
              </h3>
            </div>

            <div className="flex items-center gap-1">
              <StarRating
                rating={ratings.averageRating}
                mode="compact"
                variant="black"
                size="sm"
                ariaLabel={`Average rating: ${ratings.averageRating.toFixed(1)} out of 5 stars`}
              />
              <span className="font-medium text-gray-700 leading-none">
                {ratings.averageRating.toFixed(1)} ({ratings.totalReviews})
              </span>
            </div>

            <div className="flex items-baseline gap-1">
              <span className="font-semibold">{formatCurrency(price)}</span>
              <span className=" text-gray-500">/ day</span>
            </div>
          </div>

          <div className="relative w-[96px] h-full flex-shrink-0 overflow-hidden">
            <img
              src={getOptimizedImageUrl(imageUrl, { width: 120 })}
              alt={carName}
              className="w-full h-full object-cover"
              width={96}
              height={96}
              loading={priority ? "eager" : "lazy"}
              fetchPriority={priority ? "high" : "auto"}
              decoding="async"
            />

            <div
              className="absolute left-0 top-0 bg-white z-10"
              style={{
                width: "100%",
                height: "100%",
                transform: "rotate(80deg)",
                transformOrigin: "top left",
              }}
            />
          </div>
        </div>
      </div>
    </Link>
  );
}
