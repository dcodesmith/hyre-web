import { Sparkles, Tag, Users } from "lucide-react";
import { Link } from "react-router";

import { CompactStarRating } from "~/components/home/compact-star-rating";
import type { PublicCar } from "~/lib/api/contracts/car-categories";
import {
  applyPromotionDiscount,
  buildCarDetailPath,
  formatCurrency,
  hasActivePromotion,
  isNewListing,
  promotionBadgeLabel,
} from "~/lib/car-presentation";
import { cn } from "~/lib/utils";

interface VehicleCardProps {
  readonly car: PublicCar;
  readonly priority?: boolean;
}

interface VehicleCardBadgesProps {
  readonly createdAt: PublicCar["createdAt"];
  readonly promotion: PublicCar["promotion"];
  readonly averageRating: number;
  readonly totalReviews: number;
}

function VehicleCardBadges({
  createdAt,
  promotion,
  averageRating,
  totalReviews,
}: VehicleCardBadgesProps) {
  const onPromotion = hasActivePromotion(promotion);
  const showNewBadge = isNewListing(createdAt);
  const displayRating = Math.max(0, Math.min(5, averageRating));
  const ratingLabel = `Average rating: ${displayRating.toFixed(1)} out of 5 stars`;

  return (
    <>
      {showNewBadge || onPromotion ? (
        <div className="absolute top-3 left-3 flex items-center gap-1.5">
          {showNewBadge ? (
            <div className="flex items-center gap-1 rounded-full bg-white/90 px-2 py-1.5 shadow-md">
              <Sparkles aria-hidden="true" className="size-3 text-amber-500" />
              <span className="text-xs leading-none font-medium text-gray-800">New</span>
            </div>
          ) : null}
          {onPromotion ? (
            <div className="flex items-center gap-1 rounded-full bg-red-500/95 px-2 py-1.5 shadow-md">
              <Tag aria-hidden="true" className="size-3 text-white" />
              <span className="text-xs leading-none font-semibold text-white">
                {promotionBadgeLabel(promotion.discountValue)}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      {totalReviews > 0 ? (
        <div className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full bg-white/90 px-2 py-1.5 shadow-md transition-colors hover:bg-white">
          <CompactStarRating rating={displayRating} ariaLabel={ratingLabel} />
          <span className="text-xs leading-none font-medium text-gray-700">
            {displayRating.toFixed(1)} ({totalReviews})
          </span>
        </div>
      ) : null}
    </>
  );
}

export function VehicleCard({ car, priority = false }: VehicleCardProps) {
  const promotion = car.promotion;
  const onPromotion = hasActivePromotion(promotion);
  const discountedRate = onPromotion
    ? applyPromotionDiscount(car.dayRate, promotion.discountValue)
    : car.dayRate;
  const showPromoPrice = onPromotion && discountedRate < car.dayRate;
  const carName = `${car.make} ${car.model} (${car.year})`;

  return (
    <Link
      to={buildCarDetailPath(car)}
      className="group block w-55 shrink-0 snap-start rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 md:w-62.5"
    >
      <div className="relative aspect-4/3 overflow-hidden rounded-xl bg-gray-100">
        {car.images[0]?.url ? (
          <img
            src={car.images[0].url}
            alt={`${carName} available for chauffeur hire`}
            width={500}
            height={375}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-sm text-gray-500">
            Image unavailable
          </div>
        )}

        <VehicleCardBadges
          createdAt={car.createdAt}
          promotion={promotion}
          averageRating={car.averageRating}
          totalReviews={car.totalReviews}
        />
      </div>

      <div className="pt-3">
        <h3 className="truncate text-sm font-semibold tracking-wide text-gray-950">{carName}</h3>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-600">
          <Users aria-hidden="true" className="size-3.5" />
          {car.passengerCapacity}-Seater
          {car.pricingIncludesFuel ? <span>• Fuel included</span> : null}
        </p>
        <p className="mt-1 flex flex-wrap items-baseline gap-1 text-sm tabular-nums">
          {showPromoPrice ? (
            <span className="text-gray-400 line-through">{formatCurrency(car.dayRate)}</span>
          ) : null}
          <span
            className={cn("font-semibold", showPromoPrice ? "text-red-600/95" : "text-gray-950")}
          >
            {formatCurrency(discountedRate)}
          </span>
          <span className="text-gray-600">/ day</span>
        </p>
      </div>
    </Link>
  );
}
