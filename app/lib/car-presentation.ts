import type { CarCategory, PublicCar } from "~/lib/api/contracts/car-categories";

const currencyFormatter = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

const categoryQueries: Readonly<
  Partial<Record<CarCategory["name"], Readonly<Record<string, string>>>>
> = {
  suv: { vehicleType: "SUV" },
  sedan: { vehicleType: "SEDAN" },
  luxury: { serviceTier: "LUXURY" },
  executive: { serviceTier: "EXECUTIVE" },
  budget: { serviceTier: "STANDARD" },
};

const categorySectionIds: Readonly<Record<CarCategory["name"], string>> = {
  suv: "suvs",
  luxury: "luxury",
  budget: "budget",
  sedan: "sedans",
  executive: "executive",
  popular: "popular",
};

export function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

export function applyPromotionDiscount(originalRate: number, discountPercent: number) {
  if (originalRate <= 0 || discountPercent <= 0) {
    return originalRate;
  }

  return Math.max(1, originalRate - (originalRate * discountPercent) / 100);
}

export function promotionBadgeLabel(discountPercent: number) {
  const value = Number.isInteger(discountPercent)
    ? String(discountPercent)
    : discountPercent.toFixed(1).replace(/\.0$/, "");

  return `${value}% OFF`;
}

export function hasActivePromotion(
  promotion: PublicCar["promotion"] | undefined,
): promotion is NonNullable<PublicCar["promotion"]> {
  return (
    promotion != null && typeof promotion.discountValue === "number" && promotion.discountValue > 0
  );
}

const NEW_LISTING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function isNewListing(createdAt: string | undefined, now: Date = new Date()) {
  if (!createdAt) {
    return false;
  }

  const createdTime = Date.parse(createdAt);
  if (Number.isNaN(createdTime)) {
    return false;
  }

  return now.getTime() - createdTime < NEW_LISTING_WINDOW_MS;
}

export function buildCategorySearchPath(category: CarCategory) {
  const query = categoryQueries[category.name];

  if (!query) {
    return "/search";
  }

  return `/search?${new URLSearchParams(query).toString()}`;
}

export function getCategorySectionId(category: CarCategory) {
  return categorySectionIds[category.name];
}

export function buildCarDetailPath(car: Pick<PublicCar, "id" | "make" | "model" | "year">) {
  const shortId = car.id.slice(0, 13);
  let slug = `${car.year}-${car.make}-${car.model}`
    .toLowerCase()
    .replaceAll(/[^\w\s-]/g, "")
    .replaceAll(/[\s_]+/g, "-")
    .replaceAll(/-+/g, "-")
    .replaceAll(/^-+/g, "");

  while (slug.endsWith("-")) {
    slug = slug.slice(0, -1);
  }

  return `/cars/${slug}-${shortId}?bookingType=DAY`;
}
