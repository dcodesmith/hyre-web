import type { CarCategory, PublicCar } from "~/api/cars/schema";
import { type BookingType, DAY_BOOKING_TYPE } from "~/booking/types";

// Temporary name → filter map until hyre-worker-nestjs#190 ships category.search.
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

export const CAR_ID_PATTERN = /^c[a-z0-9]{24}$/i;
const CAR_ID_IN_SLUG_PATTERN = /-c[a-z0-9]{24}$/i;

const PRESERVED_SEARCH_KEYS = [
  "q",
  "color",
  "model",
  "vehicleType",
  "serviceTier",
  "make",
  "minPrice",
  "maxPrice",
  "minCapacity",
  "fuelIncluded",
  "dealsOnly",
  "from",
  "to",
  "bookingType",
  "pickupTime",
  "flightNumber",
] as const;

export interface CarDetailBookingQuery {
  readonly from?: string | null;
  readonly to?: string | null;
  readonly pickupTime?: string | null;
  readonly flightNumber?: string | null;
  readonly preserveSearch?: URLSearchParams;
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

export function generateCarSlug(car: Pick<PublicCar, "id" | "make" | "model" | "year">) {
  let slug = `${car.year}-${car.make}-${car.model}`
    .toLowerCase()
    .replaceAll(/[^\w\s-]/g, "")
    .replaceAll(/[\s_]+/g, "-")
    .replaceAll(/-+/g, "-")
    .replaceAll(/^-+/g, "");

  while (slug.endsWith("-")) {
    slug = slug.slice(0, -1);
  }

  return `${slug}-${car.id}`;
}

function setOrDeleteBookingParam(
  params: URLSearchParams,
  key: "from" | "to" | "pickupTime" | "flightNumber",
  value: string | null | undefined,
) {
  if (value) {
    params.set(key, value);
  } else if (value === null) {
    params.delete(key);
  }
}

export function extractCarIdFromSlug(slug: string) {
  if (CAR_ID_PATTERN.test(slug)) {
    return slug;
  }

  if (CAR_ID_IN_SLUG_PATTERN.test(slug)) {
    return slug.slice(slug.lastIndexOf("-") + 1);
  }

  return null;
}

export function buildCarDetailPath(
  car: Pick<PublicCar, "id" | "make" | "model" | "year">,
  bookingType: BookingType = DAY_BOOKING_TYPE,
  booking: CarDetailBookingQuery = {},
) {
  const params = new URLSearchParams();

  if (booking.preserveSearch) {
    for (const key of PRESERVED_SEARCH_KEYS) {
      const value = booking.preserveSearch.get(key);

      if (value) {
        params.set(key, value);
      }
    }
  }

  params.set("bookingType", bookingType);
  setOrDeleteBookingParam(params, "from", booking.from);
  setOrDeleteBookingParam(params, "to", booking.to);
  setOrDeleteBookingParam(params, "pickupTime", booking.pickupTime);
  setOrDeleteBookingParam(params, "flightNumber", booking.flightNumber);

  return `/cars/${generateCarSlug(car)}?${params}`;
}
