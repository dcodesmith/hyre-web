import type { PublicCar, SearchCar } from "~/api/cars/schema";
import { type BookingType, DAY_BOOKING_TYPE } from "~/booking/types";
import { buildCarDetailPath, type CarDetailBookingQuery } from "~/car/paths";

const DEFAULT_CURRENCY = "NGN";
const ISO_CURRENCY = /^[A-Za-z]{3}$/;

const LOCALE_BY_CURRENCY: Readonly<Record<string, string>> = {
  NGN: "en-NG",
  USD: "en-US",
  EUR: "en-GB",
  GBP: "en-GB",
};

const currencyFormatters = new Map<string, Intl.NumberFormat>();

/** Current live market is NGN. Pass an ISO 4217 code when the API sends one. */
export function formatCurrency(value: number, currency = DEFAULT_CURRENCY) {
  const code = ISO_CURRENCY.test(currency) ? currency.toUpperCase() : DEFAULT_CURRENCY;
  const cached = currencyFormatters.get(code);

  if (cached) {
    return cached.format(value);
  }

  const formatter = new Intl.NumberFormat(LOCALE_BY_CURRENCY[code] ?? "en", {
    style: "currency",
    currency: code,
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  });

  currencyFormatters.set(code, formatter);
  return formatter.format(value);
}

export function formatNaira(value: number) {
  return formatCurrency(value);
}

const NEW_LISTING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

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

export const BOOKING_TYPE_RATE_LABELS: Readonly<Record<BookingType, string>> = {
  DAY: "/ day",
  NIGHT: "/ night",
  FULL_DAY: "/ full day",
  AIRPORT_PICKUP: "/ pickup",
};

export type DisplayCar = PublicCar | SearchCar;

export function getRateForBookingType(car: DisplayCar, bookingType: BookingType) {
  if (!("nightRate" in car)) {
    return car.dayRate;
  }

  if (bookingType === "NIGHT") {
    return car.nightRate ?? car.dayRate;
  }

  if (bookingType === "FULL_DAY") {
    return car.fullDayRate ?? car.dayRate;
  }

  if (bookingType === "AIRPORT_PICKUP") {
    return car.airportPickupRate ?? car.dayRate;
  }

  return car.dayRate;
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
export function CarDomain(
  car: DisplayCar,
  now = new Date(),
  bookingType: BookingType = DAY_BOOKING_TYPE,
  booking: CarDetailBookingQuery = {},
) {
  const promotion = hasActivePromotion(car.promotion) ? car.promotion : null;
  const listRate = getRateForBookingType(car, bookingType);
  const displayRate = promotion
    ? applyPromotionDiscount(listRate, promotion.discountValue)
    : listRate;
  const displayRating = Math.max(0, Math.min(5, car.averageRating));

  return {
    isNew: isNewListing(car.createdAt, now),
    hasPromotion: promotion != null,
    promotionLabel: promotion ? promotionBadgeLabel(promotion.discountValue) : null,
    showRating: car.totalReviews > 0,
    displayRating,
    ratingLabel: `Average rating: ${displayRating.toFixed(1)} out of 5 stars`,
    name: `${car.make} ${car.model} (${car.year})`,
    href: buildCarDetailPath(car, bookingType, booking),
    imageUrl: car.images[0]?.url,
    listRate,
    displayRate,
    showPromoPrice: promotion != null && displayRate < listRate,
    listRateLabel: formatCurrency(listRate),
    displayRateLabel: formatCurrency(displayRate),
    rateLabel: BOOKING_TYPE_RATE_LABELS[bookingType],
    passengerCapacity: car.passengerCapacity,
    pricingIncludesFuel: car.pricingIncludesFuel,
    totalReviews: car.totalReviews,
  };
}
