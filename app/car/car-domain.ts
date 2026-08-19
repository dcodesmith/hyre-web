import type { PublicCar } from "~/api/cars/schema";
import { buildCarDetailPath } from "~/car/paths";

const currencyFormatter = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

const NEW_LISTING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function applyPromotionDiscount(originalRate: number, discountPercent: number) {
  if (originalRate <= 0 || discountPercent <= 0) {
    return originalRate;
  }

  return Math.max(1, originalRate - (originalRate * discountPercent) / 100);
}

function promotionBadgeLabel(discountPercent: number) {
  const value = Number.isInteger(discountPercent)
    ? String(discountPercent)
    : discountPercent.toFixed(1).replace(/\.0$/, "");

  return `${value}% OFF`;
}

function hasActivePromotion(
  promotion: PublicCar["promotion"] | undefined,
): promotion is NonNullable<PublicCar["promotion"]> {
  return (
    promotion != null && typeof promotion.discountValue === "number" && promotion.discountValue > 0
  );
}

function isNewListing(createdAt: string | undefined, now: Date) {
  if (!createdAt) {
    return false;
  }

  const createdTime = Date.parse(createdAt);
  if (Number.isNaN(createdTime)) {
    return false;
  }

  const ageMs = now.getTime() - createdTime;
  return ageMs >= 0 && ageMs < NEW_LISTING_WINDOW_MS;
}

/** Public-car display facts from the API DTO. Not availability, payable totals, or auth. */
export function CarDomain(car: PublicCar, now = new Date()) {
  const promotion = hasActivePromotion(car.promotion) ? car.promotion : null;
  const displayRate = promotion
    ? applyPromotionDiscount(car.dayRate, promotion.discountValue)
    : car.dayRate;
  const displayRating = Math.max(0, Math.min(5, car.averageRating));

  return {
    isNew: isNewListing(car.createdAt, now),
    hasPromotion: promotion != null,
    promotionLabel: promotion ? promotionBadgeLabel(promotion.discountValue) : null,
    showRating: car.totalReviews > 0,
    displayRating,
    ratingLabel: `Average rating: ${displayRating.toFixed(1)} out of 5 stars`,
    name: `${car.make} ${car.model} (${car.year})`,
    href: buildCarDetailPath(car),
    imageUrl: car.images[0]?.url,
    listRate: car.dayRate,
    displayRate,
    showPromoPrice: promotion != null && displayRate < car.dayRate,
    listRateLabel: formatCurrency(car.dayRate),
    displayRateLabel: formatCurrency(displayRate),
    passengerCapacity: car.passengerCapacity,
    pricingIncludesFuel: car.pricingIncludesFuel,
    totalReviews: car.totalReviews,
  };
}
