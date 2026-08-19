import { Sparkles, Tag, Users } from "lucide-react";
import { Link } from "react-router";

import { type BookingType, DAY_BOOKING_TYPE } from "~/booking/types";
import { CarDomain, type DisplayCar, formatNaira } from "~/car/car-domain";
import { CompactStarRating } from "~/car/compact-star-rating";
import { cn } from "~/lib/utils";

interface VehicleCardProps {
  readonly car: DisplayCar;
  readonly bookingType?: BookingType;
  readonly priority?: boolean;
  readonly showTotal?: boolean;
  readonly totalPrice?: number;
  readonly variant?: "carousel" | "grid";
}

interface VehicleCardBadgesProps {
  readonly isNew: boolean;
  readonly hasPromotion: boolean;
  readonly promotionLabel: string | null;
  readonly showRating: boolean;
  readonly displayRating: number;
  readonly ratingLabel: string;
  readonly totalReviews: number;
}

function VehicleCardBadges({
  isNew,
  hasPromotion,
  promotionLabel,
  showRating,
  displayRating,
  ratingLabel,
  totalReviews,
}: VehicleCardBadgesProps) {
  return (
    <>
      {isNew || hasPromotion ? (
        <div className="absolute top-3 left-3 flex items-center gap-1.5">
          {isNew ? (
            <div className="flex items-center gap-1 rounded-full bg-white/90 px-2 py-1.5 shadow-md">
              <Sparkles aria-hidden="true" className="size-3 text-amber-500" />
              <span className="text-xs leading-none font-medium text-gray-800">New</span>
            </div>
          ) : null}
          {hasPromotion && promotionLabel ? (
            <div className="flex items-center gap-1 rounded-full bg-red-500/95 px-2 py-1.5 shadow-md">
              <Tag aria-hidden="true" className="size-3 text-white" />
              <span className="text-xs leading-none font-semibold text-white">
                {promotionLabel}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      {showRating ? (
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

export function VehicleCard({
  car,
  bookingType = DAY_BOOKING_TYPE,
  priority = false,
  showTotal = false,
  totalPrice,
  variant = "carousel",
}: VehicleCardProps) {
  const view = CarDomain(car, new Date(), bookingType);
  const isGrid = variant === "grid";

  return (
    <Link
      to={view.href}
      className={cn(
        "group block",
        isGrid
          ? ""
          : "w-55 shrink-0 snap-start rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 md:w-62.5",
      )}
    >
      <div className={cn(isGrid && "group space-y-3 overflow-hidden")}>
        <div className="relative aspect-4/3 overflow-hidden rounded-xl bg-gray-100">
          {view.imageUrl ? (
            <img
              src={view.imageUrl}
              alt={`${view.name} available for chauffeur hire`}
              width={isGrid ? 800 : 500}
              height={isGrid ? 600 : 375}
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
            isNew={view.isNew}
            hasPromotion={view.hasPromotion}
            promotionLabel={view.promotionLabel}
            showRating={view.showRating}
            displayRating={view.displayRating}
            ratingLabel={view.ratingLabel}
            totalReviews={view.totalReviews}
          />
        </div>

        {isGrid ? (
          <div className="space-y-0.5">
            <h3 className="text-sm font-semibold tracking-wider">
              {car.make} {car.model} ({car.year})
            </h3>
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <span>{view.passengerCapacity}-Seater</span>
              {view.pricingIncludesFuel ? (
                <>
                  <span>•</span>
                  <span>Fuel Included</span>
                </>
              ) : null}
            </div>
            <div className="flex flex-wrap items-baseline gap-1 text-sm">
              {showTotal && totalPrice ? (
                <>
                  <span className="text-sm font-semibold">{formatNaira(totalPrice)}</span>
                  <span className="text-gray-600">total</span>
                </>
              ) : (
                <>
                  {view.showPromoPrice ? (
                    <span className="text-gray-400 line-through">{view.listRateLabel}</span>
                  ) : null}
                  <span className={cn("font-semibold", view.showPromoPrice && "text-red-600/95")}>
                    {view.displayRateLabel}
                  </span>
                  <span className="text-gray-600">{view.rateLabel}</span>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="pt-3">
            <h3 className="truncate text-sm font-semibold tracking-wide text-gray-950">
              {view.name}
            </h3>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-600">
              <Users aria-hidden="true" className="size-3.5" />
              {view.passengerCapacity}-Seater
              {view.pricingIncludesFuel ? <span>• Fuel included</span> : null}
            </p>
            <p className="mt-1 flex flex-wrap items-baseline gap-1 text-sm tabular-nums">
              {view.showPromoPrice ? (
                <span className="text-gray-400 line-through">{view.listRateLabel}</span>
              ) : null}
              <span
                className={cn(
                  "font-semibold",
                  view.showPromoPrice ? "text-red-600/95" : "text-gray-950",
                )}
              >
                {view.displayRateLabel}
              </span>
              <span className="text-gray-600">/ day</span>
            </p>
          </div>
        )}
      </div>
    </Link>
  );
}
