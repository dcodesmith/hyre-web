import { SERVICE_TIERS, type ServiceTier, VEHICLE_TYPES, type VehicleType } from "~/types";

/**
 * Shared search-filter definitions used by both the /search loader (server)
 * and the SearchFilters UI (client). Keep this module isomorphic — no server
 * imports.
 */

export const BOOKING_TYPE_RATE_FIELDS = {
  DAY: "dayRate",
  NIGHT: "nightRate",
  FULL_DAY: "fullDayRate",
  AIRPORT_PICKUP: "airportPickupRate",
} as const;

export type RateField = (typeof BOOKING_TYPE_RATE_FIELDS)[keyof typeof BOOKING_TYPE_RATE_FIELDS];

export function getRateFieldForBookingType(bookingType: string | null): RateField {
  if (bookingType && bookingType in BOOKING_TYPE_RATE_FIELDS) {
    return BOOKING_TYPE_RATE_FIELDS[bookingType as keyof typeof BOOKING_TYPE_RATE_FIELDS];
  }
  return "dayRate";
}

export function isServiceTier(value: string): value is ServiceTier {
  return (SERVICE_TIERS as readonly string[]).includes(value);
}

export function isVehicleType(value: string): value is VehicleType {
  return (VEHICLE_TYPES as readonly string[]).includes(value);
}

export interface SearchFilterValues {
  vehicleTypes: VehicleType[];
  serviceTiers: ServiceTier[];
  makes: string[];
  minPrice: number | null;
  maxPrice: number | null;
  minCapacity: number | null;
  fuelIncluded: boolean;
  dealsOnly: boolean;
}

export interface SearchFacets {
  makes: { name: string; count: number }[];
  price: { min: number; max: number };
}

/** URL params owned by the filter panel (cleared by "Clear all"). */
export const SEARCH_FILTER_PARAM_KEYS = [
  "vehicleType",
  "serviceTier",
  "make",
  "minPrice",
  "maxPrice",
  "minCapacity",
  "fuelIncluded",
  "dealsOnly",
] as const;

export function emptySearchFilters(): SearchFilterValues {
  return {
    vehicleTypes: [],
    serviceTiers: [],
    makes: [],
    minPrice: null,
    maxPrice: null,
    minCapacity: null,
    fuelIncluded: false,
    dealsOnly: false,
  };
}

function parseListParam(value: string | null): string[] {
  if (!value) return [];
  return [
    ...new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

function parseNonNegativeInt(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function parseBooleanParam(value: string | null): boolean {
  return value === "1" || value === "true";
}

export function parseSearchFilters(searchParams: URLSearchParams): SearchFilterValues {
  // Dedupe after uppercasing so e.g. "suv,SUV" yields a single selection
  const vehicleTypes = [
    ...new Set(
      parseListParam(searchParams.get("vehicleType"))
        .map((value) => value.toUpperCase())
        .filter(isVehicleType),
    ),
  ];

  const serviceTiers = [
    ...new Set(
      parseListParam(searchParams.get("serviceTier"))
        .map((value) => value.toUpperCase())
        .filter(isServiceTier),
    ),
  ];

  // Cap the list to keep the OR clause bounded
  const makes = parseListParam(searchParams.get("make")).slice(0, 20);

  return {
    vehicleTypes,
    serviceTiers,
    makes,
    minPrice: parseNonNegativeInt(searchParams.get("minPrice")),
    maxPrice: parseNonNegativeInt(searchParams.get("maxPrice")),
    minCapacity: parseNonNegativeInt(searchParams.get("minCapacity")),
    fuelIncluded: parseBooleanParam(searchParams.get("fuelIncluded")),
    dealsOnly: parseBooleanParam(searchParams.get("dealsOnly")),
  };
}

/**
 * Writes filter values into URL params (removing keys for unset values).
 * Also resets pagination since results change.
 */
export function applySearchFiltersToParams(
  params: URLSearchParams,
  filters: SearchFilterValues,
): URLSearchParams {
  const setOrDelete = (key: string, value: string | null) => {
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
  };

  const numberOrNull = (value: number | null) => (value === null ? null : String(value));

  setOrDelete("vehicleType", filters.vehicleTypes.join(",") || null);
  setOrDelete("serviceTier", filters.serviceTiers.join(",") || null);
  setOrDelete("make", filters.makes.join(",") || null);
  setOrDelete("minPrice", numberOrNull(filters.minPrice));
  setOrDelete("maxPrice", numberOrNull(filters.maxPrice));
  setOrDelete("minCapacity", numberOrNull(filters.minCapacity));
  setOrDelete("fuelIncluded", filters.fuelIncluded ? "1" : null);
  setOrDelete("dealsOnly", filters.dealsOnly ? "1" : null);
  params.delete("page");

  return params;
}

/** Number of active filter selections, shown as a badge on the Filters button. */
export function countActiveSearchFilters(filters: SearchFilterValues): number {
  const hasPriceFilter = filters.minPrice !== null || filters.maxPrice !== null;
  const hasCapacityFilter = filters.minCapacity !== null;

  return (
    filters.vehicleTypes.length +
    filters.serviceTiers.length +
    filters.makes.length +
    (hasPriceFilter ? 1 : 0) +
    (hasCapacityFilter ? 1 : 0) +
    (filters.fuelIncluded ? 1 : 0) +
    (filters.dealsOnly ? 1 : 0)
  );
}
