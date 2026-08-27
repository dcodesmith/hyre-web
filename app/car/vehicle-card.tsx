import { Sparkles, Tag, Users } from "lucide-react";
import { Link } from "react-router";

import { type BookingType, DAY_BOOKING_TYPE } from "~/booking/types";
import { CarDomain, type DisplayCar } from "~/car/car-domain";
import { CompactStarRating } from "~/car/compact-star-rating";
import type { CarDetailBookingQuery } from "~/car/paths";
import { cn } from "~/lib/utils";
import { formatCurrency } from "~/money/currency";

type CarView = ReturnType<typeof CarDomain>;

interface VehicleCardProps {
  readonly car: DisplayCar;
  readonly bookingType?: BookingType;
  readonly booking?: CarDetailBookingQuery;
  readonly priority?: boolean;
  readonly showTotal?: boolean;
  readonly totalUnits?: number;
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

interface VehicleCardImageProps {
  readonly imageUrl: string | undefined;
  readonly name: string;
  readonly isGrid: boolean;
  readonly priority: boolean;
}

interface VehicleCardRateProps {
  readonly view: CarView;
  readonly priceClassName: string;
}

interface VehicleCardGridDetailsProps {
  readonly car: DisplayCar;
  readonly view: CarView;
  readonly showTotal: boolean;
  readonly totalUnits: number;
}

interface VehicleCardCarouselDetailsProps {
  readonly view: CarView;
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

function VehicleCardImage({ imageUrl, name, isGrid, priority }: VehicleCardImageProps) {
  if (!imageUrl) {
    return (
      <div className="flex size-full items-center justify-center text-sm text-gray-500">
        Image unavailable
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={`${name} available for chauffeur hire`}
      width={isGrid ? 800 : 500}
      height={isGrid ? 600 : 375}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none"
    />
  );
}

function VehicleCardRate({ view, priceClassName }: VehicleCardRateProps) {
  return (
    <>
      {view.showPromoPrice ? (
        <span className="text-gray-400 line-through">{view.listRateLabel}</span>
      ) : null}
      <span className={priceClassName}>{view.displayRateLabel}</span>
      <span className="text-gray-600">{view.rateLabel}</span>
    </>
  );
}

function VehicleCardGridDetails({ car, view, showTotal, totalUnits }: VehicleCardGridDetailsProps) {
  const totalPrice = showTotal && totalUnits > 0 ? view.displayRate * totalUnits : undefined;

  return (
    <div className="space-y-0.5">
      <h3 className="wrap-break-word text-sm font-semibold tracking-wider">
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
      <div className="flex flex-wrap items-baseline gap-1 text-sm tabular-nums">
        {totalPrice ? (
          <>
            <span className="text-sm font-semibold">{formatCurrency(totalPrice)}</span>
            <span className="text-gray-600">total</span>
          </>
        ) : (
          <VehicleCardRate
            view={view}
            priceClassName={cn("font-semibold", view.showPromoPrice && "text-red-600/95")}
          />
        )}
      </div>
    </div>
  );
}

function VehicleCardCarouselDetails({ view }: VehicleCardCarouselDetailsProps) {
  return (
    <div className="pt-3">
      <h3 className="truncate text-sm font-semibold tracking-wider">{view.name}</h3>
      <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-600">
        <Users aria-hidden="true" className="size-3.5" />
        {view.passengerCapacity}-Seater
        {view.pricingIncludesFuel ? <span>• Fuel included</span> : null}
      </p>
      <p className="mt-1 flex flex-wrap items-baseline gap-1 text-sm tabular-nums">
        <VehicleCardRate
          view={view}
          priceClassName={cn(
            "font-semibold",
            view.showPromoPrice ? "text-red-600/95" : "text-gray-950",
          )}
        />
      </p>
    </div>
  );
}

export function VehicleCard({
  car,
  bookingType = DAY_BOOKING_TYPE,
  booking,
  priority = false,
  showTotal = false,
  totalUnits = 0,
  variant = "carousel",
}: VehicleCardProps) {
  const view = CarDomain(car, new Date(), bookingType, booking);
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
          <VehicleCardImage
            imageUrl={view.imageUrl}
            name={view.name}
            isGrid={isGrid}
            priority={priority}
          />

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
          <VehicleCardGridDetails
            car={car}
            view={view}
            showTotal={showTotal}
            totalUnits={totalUnits}
          />
        ) : (
          <VehicleCardCarouselDetails view={view} />
        )}
      </div>
    </Link>
  );
}
