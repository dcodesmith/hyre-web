import { type BookingType, DAY_BOOKING_TYPE } from "~/booking/types";
import { generateCarSlug } from "~/car/paths";
import { parseSearchUrl, type SearchUrlQuery, serializeSearchUrl } from "~/search/search-url";

export const DEFAULT_REVIEWS_PAGE = 1;
export const CAR_REVIEWS_LIMIT = 12;

export interface CarDetailUrlQuery {
  readonly search: SearchUrlQuery;
  readonly bookingType: BookingType;
  readonly reviewsOpen: boolean;
  readonly reviewsPage: number;
}

export function parseCarDetailUrl(searchParams: URLSearchParams): CarDetailUrlQuery {
  const search = parseSearchUrl(searchParams);
  const reviewsPage = Number.parseInt(searchParams.get("reviewsPage") ?? "", 10);

  return {
    search,
    bookingType: search.bookingType ?? DAY_BOOKING_TYPE,
    reviewsOpen: searchParams.get("reviews") === "1" || searchParams.get("reviews") === "true",
    reviewsPage:
      Number.isInteger(reviewsPage) && reviewsPage >= 1 ? reviewsPage : DEFAULT_REVIEWS_PAGE,
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
  const query = params.toString();

  return query ? `/search?${query}` : "/search";
}
