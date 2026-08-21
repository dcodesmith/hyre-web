import { AIRPORT_PICKUP_BOOKING_TYPE, type BookingType, DAY_BOOKING_TYPE } from "~/booking/types";
import { generateCarSlug } from "~/car/paths";
import { parseSearchUrl, type SearchUrlQuery, serializeSearchUrl } from "~/search/search-url";

export const DEFAULT_REVIEWS_PAGE = 1;
export const CAR_REVIEWS_LIMIT = 12;
const MAX_ADDRESS_LENGTH = 256;
const CAR_LOCATION_PARAM_KEYS = ["pickupAddress", "dropOffAddress", "sameLocation"] as const;

export interface CarDetailUrlQuery {
  readonly search: SearchUrlQuery;
  readonly bookingType: BookingType;
  readonly reviewsOpen: boolean;
  readonly reviewsPage: number;
  readonly pickupAddress: string | null;
  readonly dropOffAddress: string | null;
  readonly sameLocation: boolean;
}

function parseReviewsPage(value: string | null) {
  if (!value || !/^\d+$/.test(value)) {
    return DEFAULT_REVIEWS_PAGE;
  }

  const page = Number(value);
  return page >= 1 ? page : DEFAULT_REVIEWS_PAGE;
}

function parseAddress(value: string | null) {
  const trimmed = value?.trim();

  if (!trimmed || trimmed.length > MAX_ADDRESS_LENGTH) {
    return null;
  }

  return trimmed;
}

export function parseCarDetailUrl(searchParams: URLSearchParams): CarDetailUrlQuery {
  const search = parseSearchUrl(searchParams);
  const bookingType = search.bookingType ?? DAY_BOOKING_TYPE;
  const isAirportPickup = bookingType === AIRPORT_PICKUP_BOOKING_TYPE;

  return {
    search,
    bookingType,
    reviewsOpen: searchParams.get("reviews") === "1" || searchParams.get("reviews") === "true",
    reviewsPage: parseReviewsPage(searchParams.get("reviewsPage")),
    pickupAddress: parseAddress(searchParams.get("pickupAddress")),
    dropOffAddress: parseAddress(searchParams.get("dropOffAddress")),
    sameLocation: isAirportPickup ? false : searchParams.get("sameLocation") !== "false",
  };
}

export function buildCarDetailSearchPath(
  car: { id: string; make: string; model: string; year: number },
  query: CarDetailUrlQuery,
) {
  const params = serializeSearchUrl({
    ...query.search,
    bookingType: query.bookingType,
    page: 1,
    limit: 12,
    countOnly: false,
  });

  params.delete("page");
  params.delete("limit");
  params.delete("countOnly");

  if (query.reviewsOpen) {
    params.set("reviews", "1");
  }

  if (query.reviewsPage > DEFAULT_REVIEWS_PAGE) {
    params.set("reviewsPage", String(query.reviewsPage));
  }

  if (query.pickupAddress) {
    params.set("pickupAddress", query.pickupAddress);
  }

  if (!query.sameLocation && query.dropOffAddress) {
    params.set("dropOffAddress", query.dropOffAddress);
  }

  if (!query.sameLocation) {
    params.set("sameLocation", "false");
  }

  return `/cars/${generateCarSlug(car)}?${params}`;
}

export function buildBookingTypeCarPath(
  car: { id: string; make: string; model: string; year: number },
  bookingType: BookingType,
  current: CarDetailUrlQuery,
) {
  return buildCarDetailSearchPath(car, {
    search: {
      ...current.search,
      bookingType,
      from: null,
      to: null,
      pickupTime: null,
      flightNumber: null,
    },
    bookingType,
    reviewsOpen: current.reviewsOpen,
    reviewsPage: current.reviewsPage,
    pickupAddress: null,
    dropOffAddress: null,
    sameLocation: bookingType !== AIRPORT_PICKUP_BOOKING_TYPE,
  });
}

export function shouldRevalidateCarDetail(
  currentParams: URLSearchParams,
  nextParams: URLSearchParams,
) {
  const current = parseCarDetailUrl(currentParams);
  const next = parseCarDetailUrl(nextParams);

  return current.search.from !== next.search.from || current.reviewsPage !== next.reviewsPage;
}

export function buildBackToSearchPath(searchParams: URLSearchParams) {
  const params = new URLSearchParams(searchParams);
  params.delete("reviews");
  params.delete("reviewsPage");

  for (const key of CAR_LOCATION_PARAM_KEYS) {
    params.delete(key);
  }

  const query = params.toString();

  return query ? `/search?${query}` : "/search";
}
