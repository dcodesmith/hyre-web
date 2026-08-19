import { BOOKING_TYPE_OPTIONS, type BookingType } from "~/booking/types";
import { formatZonedDate, parseZonedCalendarDate } from "~/time/timezone";

export const VEHICLE_TYPES = ["SEDAN", "SUV", "VAN", "CROSSOVER"] as const;
export const SERVICE_TIERS = ["STANDARD", "EXECUTIVE", "LUXURY", "ULTRA_LUXURY"] as const;

export type VehicleType = (typeof VEHICLE_TYPES)[number];
export type ServiceTier = (typeof SERVICE_TIERS)[number];

export const vehicleTypeLabels: Readonly<Record<VehicleType, string>> = {
  SEDAN: "Sedan",
  SUV: "SUV",
  VAN: "Van / Minibus",
  CROSSOVER: "Crossover",
};

export const serviceTierLabels: Readonly<Record<ServiceTier, string>> = {
  STANDARD: "Standard",
  EXECUTIVE: "Executive",
  LUXURY: "Luxury",
  ULTRA_LUXURY: "Ultra Luxury",
};

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

export const SEARCH_BOOKING_PARAM_KEYS = [
  "from",
  "to",
  "bookingType",
  "pickupTime",
  "flightNumber",
] as const;

const DATE_PARAM_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const NON_NEGATIVE_INT_PATTERN = /^\d+$/;
const PICKUP_TIME_PATTERN = /^(1[0-2]|[1-9])(:[0-5]\d)?\s?(AM|PM)$/i;
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;
const MAX_MAKES = 20;

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

export interface SearchUrlQuery extends SearchFilterValues {
  q: string | null;
  color: string | null;
  model: string | null;
  from: string | null;
  to: string | null;
  bookingType: BookingType | null;
  pickupTime: string | null;
  flightNumber: string | null;
  page: number;
  limit: number;
  countOnly: boolean;
}

export function isVehicleType(value: string): value is VehicleType {
  return (VEHICLE_TYPES as readonly string[]).includes(value);
}

export function isServiceTier(value: string): value is ServiceTier {
  return (SERVICE_TIERS as readonly string[]).includes(value);
}

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

export function parseSearchFilters(searchParams: URLSearchParams): SearchFilterValues {
  const minPrice = parseNonNegativeInt(searchParams.get("minPrice"));
  const maxPrice = parseNonNegativeInt(searchParams.get("maxPrice"));

  return {
    vehicleTypes: parseEnumList(searchParams.get("vehicleType"), isVehicleType),
    serviceTiers: parseEnumList(searchParams.get("serviceTier"), isServiceTier),
    makes: parseListParam(searchParams.get("make")).slice(0, MAX_MAKES),
    minPrice,
    maxPrice: minPrice !== null && maxPrice !== null && maxPrice < minPrice ? null : maxPrice,
    minCapacity: parseNonNegativeInt(searchParams.get("minCapacity")),
    fuelIncluded: parseBooleanParam(searchParams.get("fuelIncluded")),
    dealsOnly: parseBooleanParam(searchParams.get("dealsOnly")),
  };
}

export function parseSearchUrl(searchParams: URLSearchParams): SearchUrlQuery {
  const filters = parseSearchFilters(searchParams);
  const bookingType = parseBookingType(searchParams.get("bookingType"));

  return {
    ...filters,
    q: parseOptionalText(searchParams.get("q")),
    color: parseOptionalText(searchParams.get("color")),
    model: parseOptionalText(searchParams.get("model")),
    from: parseDateParam(searchParams.get("from")),
    to: parseDateParam(searchParams.get("to")),
    bookingType,
    pickupTime: parsePickupTime(searchParams.get("pickupTime")),
    flightNumber: parseOptionalText(searchParams.get("flightNumber")),
    page: parseBoundedInt(searchParams.get("page"), DEFAULT_PAGE, 1),
    limit: parseBoundedInt(searchParams.get("limit"), DEFAULT_LIMIT, 1, MAX_LIMIT),
    countOnly: parseBooleanParam(searchParams.get("countOnly")),
  };
}

export function applySearchFiltersToParams(
  params: URLSearchParams,
  filters: SearchFilterValues,
): URLSearchParams {
  setOrDelete(params, "vehicleType", filters.vehicleTypes.join(",") || null);
  setOrDelete(params, "serviceTier", filters.serviceTiers.join(",") || null);
  setOrDelete(params, "make", filters.makes.join(",") || null);
  setOrDelete(params, "minPrice", numberOrNull(filters.minPrice));
  setOrDelete(params, "maxPrice", numberOrNull(filters.maxPrice));
  setOrDelete(params, "minCapacity", numberOrNull(filters.minCapacity));
  setOrDelete(params, "fuelIncluded", filters.fuelIncluded ? "1" : null);
  setOrDelete(params, "dealsOnly", filters.dealsOnly ? "1" : null);
  params.delete("page");
  params.delete("countOnly");

  return params;
}

export function serializeSearchUrl(query: SearchUrlQuery): URLSearchParams {
  const params = applySearchFiltersToParams(new URLSearchParams(), query);

  setOrDelete(params, "q", query.q);
  setOrDelete(params, "color", query.color);
  setOrDelete(params, "model", query.model);
  setOrDelete(params, "from", query.from);
  setOrDelete(params, "to", query.to);
  setOrDelete(params, "bookingType", query.bookingType);
  setOrDelete(params, "pickupTime", query.pickupTime);
  setOrDelete(params, "flightNumber", query.flightNumber);

  if (query.page > DEFAULT_PAGE) {
    params.set("page", String(query.page));
  }

  if (query.limit !== DEFAULT_LIMIT) {
    params.set("limit", String(query.limit));
  }

  if (query.countOnly) {
    params.set("countOnly", "1");
  }

  return params;
}

export function toApiSearchParams(query: SearchUrlQuery): URLSearchParams {
  const params = serializeSearchUrl(query);
  params.set("page", String(query.page));
  params.set("limit", String(query.limit));

  return params;
}

export function countActiveSearchFilters(filters: SearchFilterValues): number {
  return (
    filters.vehicleTypes.length +
    filters.serviceTiers.length +
    filters.makes.length +
    (filters.minPrice !== null || filters.maxPrice !== null ? 1 : 0) +
    (filters.minCapacity !== null ? 1 : 0) +
    (filters.fuelIncluded ? 1 : 0) +
    (filters.dealsOnly ? 1 : 0)
  );
}

export function buildSearchPath(searchParams: URLSearchParams): string {
  const query = searchParams.toString();

  return query ? `/search?${query}` : "/search";
}

export function buildBookingTypeSearchPath(
  bookingType: BookingType,
  searchParams: URLSearchParams = new URLSearchParams(),
): string {
  const params = new URLSearchParams(searchParams);

  for (const key of SEARCH_BOOKING_PARAM_KEYS) {
    params.delete(key);
  }

  params.set("bookingType", bookingType);
  params.delete("page");
  params.delete("countOnly");

  return buildSearchPath(params);
}

export function searchResultsIdentity(searchParams: URLSearchParams): string {
  const query = parseSearchUrl(searchParams);
  const hasDateRange = Boolean(query.from && query.to);
  const bookingTypeAffectsResults =
    hasDateRange || query.minPrice !== null || query.maxPrice !== null;

  return JSON.stringify({
    q: query.q,
    color: query.color,
    model: query.model,
    from: query.from,
    to: query.to,
    vehicleTypes: query.vehicleTypes,
    serviceTiers: query.serviceTiers,
    makes: query.makes,
    minPrice: query.minPrice,
    maxPrice: query.maxPrice,
    minCapacity: query.minCapacity,
    fuelIncluded: query.fuelIncluded,
    dealsOnly: query.dealsOnly,
    page: query.page,
    limit: query.limit,
    bookingType: bookingTypeAffectsResults ? query.bookingType : null,
    pickupTime: hasDateRange ? query.pickupTime : null,
  });
}

export function shouldRevalidateSearch(
  currentParams: URLSearchParams,
  nextParams: URLSearchParams,
): boolean {
  if (nextParams.get("countOnly") === "1") {
    return false;
  }

  return searchResultsIdentity(currentParams) !== searchResultsIdentity(nextParams);
}

export function clearSearchFiltersPath(searchParams: URLSearchParams): string {
  const params = new URLSearchParams(searchParams);

  for (const key of SEARCH_FILTER_PARAM_KEYS) {
    params.delete(key);
  }

  params.delete("page");
  params.delete("countOnly");

  return buildSearchPath(params);
}

function parseListParam(value: string | null): string[] {
  if (!value) {
    return [];
  }

  return [
    ...new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

function parseEnumList<T extends string>(
  value: string | null,
  isAllowed: (item: string) => item is T,
): T[] {
  const unique = new Set<T>();

  for (const item of parseListParam(value)) {
    const normalized = item.toUpperCase();

    if (isAllowed(normalized)) {
      unique.add(normalized);
    }
  }

  return [...unique];
}

function parseNonNegativeInt(value: string | null): number | null {
  if (!value || !NON_NEGATIVE_INT_PATTERN.test(value)) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function parseBoundedInt(
  value: string | null,
  fallback: number,
  min: number,
  max = Number.POSITIVE_INFINITY,
) {
  const parsed = parseNonNegativeInt(value);

  if (parsed === null) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

function parseBooleanParam(value: string | null): boolean {
  return value === "1" || value === "true";
}

function parseOptionalText(value: string | null): string | null {
  const trimmed = value?.trim();

  return trimmed || null;
}

function parseDateParam(value: string | null): string | null {
  const trimmed = parseOptionalText(value);

  if (!trimmed) {
    return null;
  }

  if (DATE_PARAM_PATTERN.test(trimmed)) {
    return parseZonedCalendarDate(trimmed) ? trimmed : null;
  }

  const parsed = new Date(trimmed);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return formatZonedDate(parsed);
}

function parsePickupTime(value: string | null): string | null {
  const trimmed = parseOptionalText(value);

  if (!trimmed || !PICKUP_TIME_PATTERN.test(trimmed)) {
    return null;
  }

  return trimmed.replace(/\s+/g, " ").replace(/(am|pm)$/i, (period) => period.toUpperCase());
}

function isBookingType(value: string): value is BookingType {
  return (BOOKING_TYPE_OPTIONS as readonly string[]).includes(value);
}

function parseBookingType(value: string | null): BookingType | null {
  return value !== null && isBookingType(value) ? value : null;
}

function setOrDelete(params: URLSearchParams, key: string, value: string | null) {
  if (value) {
    params.set(key, value);
  } else {
    params.delete(key);
  }
}

function numberOrNull(value: number | null) {
  return value === null ? null : String(value);
}
