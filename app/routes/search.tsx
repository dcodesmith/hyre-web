import {
  type Booking,
  BookingStatus,
  BookingType,
  type Car,
  CarApprovalStatus,
  Prisma,
  Status,
} from "@prisma/client";
import { fromZonedTime } from "date-fns-tz";
import { useCallback, useMemo, useState } from "react";
import {
  Link,
  type LoaderFunctionArgs,
  type MetaFunction,
  data,
  useLoaderData,
  useMatches,
  useNavigation,
  useParams,
  useSearchParams,
} from "react-router";

import { BookingSearch, BookingSearchDraftProvider } from "~/components/BookingSearch";
import { CarCard } from "~/components/CarCard";
import { CarSkeleton } from "~/components/CarSkeleton";
import { CompactSearchBar } from "~/components/CompactSearchBar";
import { PaginationControl } from "~/components/PaginationControl";
import { SearchFilters } from "~/components/SearchFilters";
import { SearchModal } from "~/components/SearchModal";
import {
  AIRPORT_PICKUP_BOOKING_TYPE,
  BOOKING_TYPE_OPTIONS,
  BOOKING_TYPE_OPTIONS_MAP,
  FULL_DAY_BOOKING_TYPE,
  NIGHT_BOOKING_TYPE,
} from "~/components/bookingTypes";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { useInfiniteScroll } from "~/hooks/useInfiniteScroll";
import { calculateBookingUnits } from "~/lib/booking-utils";
import logger from "~/lib/logger.server";
import {
  type RateField,
  SEARCH_FILTER_PARAM_KEYS,
  type SearchFacets,
  type SearchFilterValues,
  countActiveSearchFilters,
  getRateFieldForBookingType,
  parseSearchFilters,
} from "~/lib/search-filters";
import { prisma } from "~/modules/db/db.server";
import { availableCarsForSpecificRequest } from "~/services/availability-engine.server";
import { validateFlight } from "~/services/flight-validation.server";
import { getPublicPartnerBySlug } from "~/services/partners.server";
import {
  type ActivePromotion,
  getActivePromotionsForCars,
  getPromotionBadgeLabel,
} from "~/services/promotions.server";
import { getBatchCarRatings } from "~/services/reviews.server";
import type { AggregatedRatings } from "~/services/reviews.server";
import type { SerializedCar, ServiceTier, VehicleType } from "~/types";
import { serviceTierLabels, vehicleTypeLabels } from "~/types";
import { generateMetaTags } from "~/utils/seo";
import { LAGOS_TIMEZONE } from "~/utils/timezone";

interface PickupTimeWindow {
  specificFrom: Date;
  specificTo: Date | undefined;
}

/**
 * Parses a pickup time string (e.g., "10 AM" or "2 PM") and converts it to UTC.
 */
function parsePickupTimeToUTC(
  effectivePickupTime: string,
  fromDate: string,
  toDate: Date,
): PickupTimeWindow {
  const timeRegex = /^(\d+)\s*(AM|PM)$/i;
  const timeMatch = timeRegex.exec(effectivePickupTime);

  if (!timeMatch) {
    logger.warn("Invalid pickup time format", { pickupTime: effectivePickupTime });
  }

  let hours = timeMatch ? Number.parseInt(timeMatch[1], 10) : 7;
  const isPM = timeMatch ? timeMatch[2].toUpperCase() === "PM" : false;

  // Convert to 24-hour format
  if (isPM && hours !== 12) {
    hours += 12;
  } else if (!isPM && hours === 12) {
    hours = 0;
  }

  // Create a date string in Lagos timezone and convert to UTC
  const lagosDateString = `${fromDate}T${hours.toString().padStart(2, "0")}:00:00`;
  const specificFrom = fromZonedTime(lagosDateString, LAGOS_TIMEZONE);

  return { specificFrom, specificTo: toDate };
}

/**
 * Determines if availability filtering should be applied based on search params.
 */
function shouldFilterByAvailability(
  from: string | null,
  to: string | null,
  carsCount: number,
  bookingType: string | null,
  pickupTime: string | null,
  flightNumber: string | null,
): boolean {
  if (!from || !to || carsCount === 0 || !bookingType) {
    return false;
  }
  return !!(
    pickupTime ||
    bookingType === NIGHT_BOOKING_TYPE ||
    (bookingType === AIRPORT_PICKUP_BOOKING_TYPE && flightNumber)
  );
}

/**
 * Validates an airport pickup flight and calculates the pickup/dropoff window.
 */
async function getAirportPickupTimeWindow(
  flightNumber: string,
  fromDate: string,
  fallbackFrom: Date,
): Promise<PickupTimeWindow> {
  try {
    const result = await validateFlight(flightNumber, fromDate);

    if (result.type === "success") {
      const arrivalTimeStr =
        result.flight.actualArrival ||
        result.flight.estimatedArrival ||
        result.flight.scheduledArrival;
      const arrivalTime = new Date(arrivalTimeStr);

      // Pickup time = arrival + 40 min buffer
      const pickupTime = new Date(arrivalTime.getTime() + 40 * 60 * 1000);
      // Conservative 3-hour window for availability check
      const dropoffTime = new Date(pickupTime.getTime() + 3 * 60 * 60 * 1000);

      logger.info("[AIRPORT_PICKUP] Availability check with flight times", {
        flightNumber,
        arrivalTime: arrivalTime.toISOString(),
        pickupTime: pickupTime.toISOString(),
        estimatedDropoff: dropoffTime.toISOString(),
      });

      return { specificFrom: pickupTime, specificTo: dropoffTime };
    }

    logger.warn("[AIRPORT_PICKUP] Flight validation failed, skipping availability check", {
      flightNumber,
      resultType: result.type,
    });
    return { specificFrom: fallbackFrom, specificTo: undefined };
  } catch (error) {
    logger.error("[AIRPORT_PICKUP] Error validating flight", { error, flightNumber });
    return { specificFrom: fallbackFrom, specificTo: undefined };
  }
}

/**
 * Retrieves the IDs of fleet owners who are effectively 'unavailable'
 * on a specific date.
 */
async function getFleetOwnersWithNoChauffeursOrAllChauffeursBusy(
  specificDateInput: Date = new Date(),
): Promise<string[]> {
  const year = specificDateInput.getUTCFullYear();
  const month = specificDateInput.getUTCMonth();
  const day = specificDateInput.getUTCDate();

  const startDateAtTargetDate = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  const endDateAtTargetDate = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));

  const fleetOwnersWithNoChauffeursOrAllChauffeursBusy = await prisma.user.findMany({
    where: {
      cars: { some: {} },
      isOwnerDriver: false,
      OR: [
        { chauffeurs: { none: {} } },
        {
          chauffeurs: {
            some: {},
            every: {
              bookingsAsChauffeur: {
                some: {
                  status: { in: ["PENDING", "CONFIRMED", "ACTIVE"] },
                  AND: [
                    { startDate: { lte: endDateAtTargetDate } },
                    { endDate: { gte: startDateAtTargetDate } },
                  ],
                },
              },
            },
          },
        },
      ],
    },
    select: { id: true },
    distinct: ["id"],
    orderBy: { id: "asc" },
  });

  logger.info(
    `Found ${fleetOwnersWithNoChauffeursOrAllChauffeursBusy.length} fleet owners with no chauffeurs or all chauffeurs unavailable`,
  );

  return fleetOwnersWithNoChauffeursOrAllChauffeursBusy.map((owner) => owner.id);
}

function isBookingType(value: string): value is BookingType {
  return (BOOKING_TYPE_OPTIONS as readonly string[]).includes(value);
}

/**
 * Filters cars by availability based on booking params.
 * Returns the filtered list of cars or the original list if filtering isn't needed.
 */
async function filterCarsByAvailability<T extends { id: string }>(
  cars: T[],
  params: {
    from: string | null;
    to: string | null;
    bookingType: string | null;
    pickupTime: string | null;
    flightNumber: string | null;
  },
): Promise<T[]> {
  const { from, to, bookingType, pickupTime, flightNumber } = params;

  if (!shouldFilterByAvailability(from, to, cars.length, bookingType, pickupTime, flightNumber)) {
    return cars;
  }

  const carIds = cars.map((c) => c.id);
  const fromStart = new Date(`${from}T00:00:00.000Z`);
  const toStart = new Date(`${to}T00:00:00.000Z`);
  const endWindow = new Date(toStart);
  endWindow.setUTCDate(endWindow.getUTCDate() + 1);
  endWindow.setUTCHours(5, 0, 0, 0);

  const bookings = await prisma.booking.findMany({
    where: {
      carId: { in: carIds },
      status: { in: [BookingStatus.CONFIRMED, BookingStatus.ACTIVE] },
      AND: [{ startDate: { lt: endWindow } }, { endDate: { gt: fromStart } }],
    },
    select: { carId: true, type: true, startDate: true, endDate: true, status: true },
  });

  const carsForEngine = cars.map((c) => ({ id: c.id })) as unknown as Car[];
  const bookingsForEngine = bookings as unknown as Booking[];
  const validFrom = from as string;
  const effectivePickupTime =
    bookingType === NIGHT_BOOKING_TYPE && !pickupTime ? "11 PM" : (pickupTime as string);

  const timeWindow =
    bookingType === AIRPORT_PICKUP_BOOKING_TYPE && flightNumber
      ? await getAirportPickupTimeWindow(flightNumber, validFrom, fromStart)
      : parsePickupTimeToUTC(effectivePickupTime, validFrom, toStart);

  const { specificFrom, specificTo } = timeWindow;

  logger.info("[SEARCH] Availability check", {
    bookingType,
    pickupTime,
    specificFrom: specificFrom.toISOString(),
    specificTo: specificTo?.toISOString(),
    bookingsCount: bookingsForEngine.length,
  });

  const availableCarIdsList = availableCarsForSpecificRequest(carsForEngine, bookingsForEngine, {
    bookingType: bookingType as BookingType,
    from: specificFrom,
    to: specificTo,
  });

  logger.debug("[SEARCH] Available cars after filtering", {
    availableCarIdsList,
    filteredOutCount: carsForEngine.length - availableCarIdsList.length,
  });

  const availableCarIdsSet = new Set(availableCarIdsList);
  return cars.filter((c) => availableCarIdsSet.has(c.id));
}

/**
 * Builds SEO title parts and description context from active filters.
 * Filters only contribute to SEO copy when a single value is selected.
 */
function buildSeoContext(filters?: {
  vehicleTypes?: VehicleType[];
  serviceTiers?: ServiceTier[];
  bookingType?: string | null;
}): { titleParts: string[]; descriptionContext: string } {
  const titleParts: string[] = [];
  let descriptionContext = "";

  const selectedVehicleType =
    filters?.vehicleTypes?.length === 1 ? filters.vehicleTypes[0] : undefined;
  const selectedServiceTier =
    filters?.serviceTiers?.length === 1 ? filters.serviceTiers[0] : undefined;

  if (selectedVehicleType) {
    const vehicleLabel = vehicleTypeLabels[selectedVehicleType] || selectedVehicleType;
    titleParts.push(vehicleLabel);
    descriptionContext += `${vehicleLabel} vehicles`;
  }

  if (selectedServiceTier) {
    const tierLabel = serviceTierLabels[selectedServiceTier] || selectedServiceTier;
    titleParts.push(tierLabel);
    descriptionContext += descriptionContext
      ? ` with ${tierLabel} service`
      : `${tierLabel} vehicles`;
  }

  if (filters?.bookingType) {
    const bookingType = filters.bookingType;
    // Use the user-friendly label instead of raw enum value
    const bookingLabel =
      BOOKING_TYPE_OPTIONS_MAP[bookingType as keyof typeof BOOKING_TYPE_OPTIONS_MAP]?.label;
    if (bookingLabel && bookingType !== "DAY") {
      // Format as "Night Service" instead of just "Night for Hire"
      titleParts.push(`${bookingLabel} Service`);
    }
  }

  return { titleParts, descriptionContext };
}

/**
 * Generate dynamic meta tags based on search filters
 */
export const meta: MetaFunction<typeof loader> = ({ data, matches, location }) => {
  // Access root loader data
  const rootData = matches.find((match) => match.id === "root")?.data as
    | { ENV?: { DOMAIN?: string } }
    | undefined;

  const pagination = data?.pagination;
  const baseUrl = rootData?.ENV?.DOMAIN ?? "http://localhost:5173";
  const partnerSlugFromPath = /^\/partners\/([^/]+)\/search/.exec(location.pathname)?.[1] ?? null;
  const effectivePartnerSlug = partnerSlugFromPath ?? null;
  const searchPath = effectivePartnerSlug ? `/partners/${effectivePartnerSlug}/search` : "/search";

  const { titleParts, descriptionContext } = buildSeoContext(data?.filters);

  // Generate dynamic title
  const dynamicTitle =
    titleParts.length > 0
      ? `${titleParts.join(" ")} in Lagos | Tripdly`
      : "Search Available Cars in Lagos, Nigeria | Tripdly";

  // Generate dynamic description
  const dynamicDescription = descriptionContext
    ? `Find and book ${descriptionContext} with professional drivers in Lagos, Nigeria. Browse our selection of luxury cars for day trips, airport pickups, and special events.`
    : "Search and book available luxury vehicles with professional drivers in Nigeria. Filter by date, vehicle type, and service tier. Find the perfect car for your trip.";

  const tags = generateMetaTags({
    title: dynamicTitle,
    description: dynamicDescription,
    url: `${baseUrl}${searchPath}`,
    image: `${baseUrl}/og-image.jpg`,
    canonical: `${baseUrl}${searchPath}`,
  });

  // Add pagination links (rel="next" and rel="prev")
  if (pagination) {
    const currentPage = pagination.page;

    if (pagination.hasNextPage) {
      const nextParams = new URLSearchParams(location.search);
      nextParams.set("page", (currentPage + 1).toString());

      tags.push({
        tagName: "link",
        rel: "next",
        href: `${baseUrl}${searchPath}?${nextParams.toString()}`,
      });
    }

    if (pagination.hasPreviousPage) {
      const prevParams = new URLSearchParams(location.search);
      prevParams.set("page", (currentPage - 1).toString());

      tags.push({
        tagName: "link",
        rel: "prev",
        href: `${baseUrl}${searchPath}?${prevParams.toString()}`,
      });
    }
  }

  return tags;
};

/**
 * Maps a free-text query to vehicle type or service tier if possible.
 * Returns the matched enum values and the remaining query text for make/model search.
 *
 * For compound queries like "Toyota Luxury", this will extract "Luxury" as serviceTier
 * and return "Toyota" as the remaining query for make/model search.
 *
 * @example
 * mapQueryToFilters("Toyota Luxury") // { serviceTier: "LUXURY", remainingQuery: "Toyota" }
 * mapQueryToFilters("SUV") // { vehicleType: "SUV" }
 * mapQueryToFilters("Mercedes") // { remainingQuery: "Mercedes" }
 */
function mapQueryToFilters(query: string): {
  vehicleType?: VehicleType;
  serviceTier?: ServiceTier;
  remainingQuery?: string;
} {
  const normalizedQuery = query.trim().toLowerCase();
  let remainingQuery = query.trim();

  // Prioritize exact matches first
  for (const [type, label] of Object.entries(vehicleTypeLabels)) {
    if (normalizedQuery === label.toLowerCase() || normalizedQuery === type.toLowerCase()) {
      return { vehicleType: type as VehicleType };
    }
  }

  for (const [tier, label] of Object.entries(serviceTierLabels)) {
    if (normalizedQuery === label.toLowerCase() || normalizedQuery === tier.toLowerCase()) {
      return { serviceTier: tier as ServiceTier };
    }
  }

  // Then try partial matches (only for queries with 3+ characters)
  if (normalizedQuery.length < 3) {
    return { remainingQuery };
  }

  // Track matched terms to extract them from the query
  let matchedVehicleType: VehicleType | undefined;
  let matchedServiceTier: ServiceTier | undefined;
  let matchedLabel: string | undefined;

  for (const [type, label] of Object.entries(vehicleTypeLabels)) {
    if (
      normalizedQuery.includes(label.toLowerCase()) ||
      label.toLowerCase().includes(normalizedQuery)
    ) {
      matchedVehicleType = type as VehicleType;
      matchedLabel = label;
      break;
    }
  }

  // Try to match service tiers (only if no vehicle type was matched)
  if (!matchedVehicleType) {
    for (const [tier, label] of Object.entries(serviceTierLabels)) {
      if (
        normalizedQuery.includes(label.toLowerCase()) ||
        label.toLowerCase().includes(normalizedQuery)
      ) {
        matchedServiceTier = tier as ServiceTier;
        matchedLabel = label;
        break;
      }
    }
  }

  // Extract matched term from query to get remaining text for make/model search
  if (matchedLabel) {
    remainingQuery = remainingQuery.replaceAll(new RegExp(matchedLabel, "gi"), "").trim();
  }

  return {
    vehicleType: matchedVehicleType,
    serviceTier: matchedServiceTier,
    remainingQuery: remainingQuery || undefined,
  };
}

/**
 * Parses search query parameters from URL
 */
function parseSearchParams(url: URL) {
  const q = url.searchParams.get("q");
  const filters = parseSearchFilters(url.searchParams);
  const colorParam = url.searchParams.get("color");
  const modelParam = url.searchParams.get("model");

  const mappedFilters = q ? mapQueryToFilters(q) : undefined;

  // Add filters inferred from the free-text query only when the user hasn't
  // set them explicitly, but always keep the make/model portion of the query
  // (e.g. ?q=Toyota&vehicleType=SUV should still search for Toyota)
  if (mappedFilters && filters.vehicleTypes.length === 0 && filters.serviceTiers.length === 0) {
    if (mappedFilters.vehicleType) {
      filters.vehicleTypes.push(mappedFilters.vehicleType);
    }
    if (mappedFilters.serviceTier) {
      filters.serviceTiers.push(mappedFilters.serviceTier);
    }
  }

  const makeModelQuery = mappedFilters?.remainingQuery?.trim() || null;

  return {
    partnerSlug: url.searchParams.get("partner"),
    filters,
    colorParam,
    modelParam,
    makeModelQuery,
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
    bookingType: url.searchParams.get("bookingType"),
    pickupTime: url.searchParams.get("pickupTime"),
    flightNumber: url.searchParams.get("flightNumber"),
  };
}

/**
 * Base visibility conditions: cars that are publicly listable at all.
 * Used both for the search where clause and for facet aggregations
 * (facets intentionally ignore the user's own filter selections).
 */
function buildBaseVisibilityClauses(params: {
  partnerOwnerId?: string;
  fleetOwnersToExclude: string[];
}): Prisma.CarWhereInput[] {
  return [
    ...(params.partnerOwnerId ? [{ ownerId: params.partnerOwnerId }] : []),
    ...(params.fleetOwnersToExclude.length > 0
      ? [{ ownerId: { notIn: params.fleetOwnersToExclude } }]
      : []),
    {
      status: { in: [Status.AVAILABLE, Status.BOOKED] },
      approvalStatus: { in: [CarApprovalStatus.APPROVED] },
      owner: { fleetOwnerStatus: "APPROVED" as const, hasOnboarded: true },
    },
  ];
}

/** Conditions matching a promotion that is currently running. */
function activePromotionWhere(referenceDate: Date) {
  return {
    isActive: true,
    startDate: { lte: referenceDate },
    endDate: { gt: referenceDate },
  };
}

/**
 * Builds Prisma where clause for car search
 */
function buildCarWhereClause(params: {
  partnerOwnerId?: string;
  fleetOwnersToExclude: string[];
  filters: SearchFilterValues;
  rateField: RateField;
  colorParam: string | null;
  modelParam: string | null;
  makeModelQuery: string | null;
}): Prisma.CarWhereInput {
  const { filters, rateField } = params;
  const now = new Date();

  const hasPriceFilter = filters.minPrice !== null || filters.maxPrice !== null;

  const andClauses: Prisma.CarWhereInput[] = [
    ...buildBaseVisibilityClauses(params),
    {
      ...(filters.serviceTiers.length > 0 && { serviceTier: { in: filters.serviceTiers } }),
      ...(filters.vehicleTypes.length > 0 && { vehicleType: { in: filters.vehicleTypes } }),
      ...(filters.minCapacity !== null && { passengerCapacity: { gte: filters.minCapacity } }),
      ...(filters.fuelIncluded && { pricingIncludesFuel: true }),
      ...(hasPriceFilter && {
        [rateField]: {
          ...(filters.minPrice !== null && { gte: filters.minPrice }),
          ...(filters.maxPrice !== null && { lte: filters.maxPrice }),
        },
      }),
      ...(params.colorParam && {
        color: { contains: params.colorParam, mode: Prisma.QueryMode.insensitive },
      }),
      ...(params.modelParam && {
        model: { contains: params.modelParam, mode: Prisma.QueryMode.insensitive },
      }),
      ...(params.makeModelQuery && {
        OR: [
          { make: { contains: params.makeModelQuery, mode: Prisma.QueryMode.insensitive } },
          { model: { contains: params.makeModelQuery, mode: Prisma.QueryMode.insensitive } },
        ],
      }),
    },
    // `contains` (not `equals`) tolerates dirty data like "Toyota " with trailing whitespace
    ...(filters.makes.length > 0
      ? [
          {
            OR: filters.makes.map((make) => ({
              make: { contains: make, mode: Prisma.QueryMode.insensitive },
            })),
          },
        ]
      : []),
    // A car is on promotion if it has a car-specific promo or its owner runs a fleet-wide one
    ...(filters.dealsOnly
      ? [
          {
            OR: [
              { promotions: { some: activePromotionWhere(now) } },
              { owner: { promotions: { some: { ...activePromotionWhere(now), carId: null } } } },
            ],
          },
        ]
      : []),
  ];

  return {
    AND: andClauses,
  };
}

/**
 * Aggregates facet data (make counts, price bounds) for the filter panel.
 * Facets are computed over base visibility only, so all options stay visible
 * regardless of the user's current selections.
 */
async function getSearchFacets(
  baseWhere: Prisma.CarWhereInput,
  rateField: RateField,
): Promise<SearchFacets> {
  const [makeGroups, priceAggregate] = await Promise.all([
    prisma.car.groupBy({
      by: ["make"],
      where: baseWhere,
      _count: { _all: true },
    }),
    prisma.car.aggregate({
      where: baseWhere,
      _min: { dayRate: true, nightRate: true, fullDayRate: true, airportPickupRate: true },
      _max: { dayRate: true, nightRate: true, fullDayRate: true, airportPickupRate: true },
    }),
  ]);

  // Merge dirty values like "Toyota " and "Toyota" into one facet entry
  const makeMap = new Map<string, { name: string; count: number }>();
  for (const group of makeGroups) {
    const name = group.make.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const existing = makeMap.get(key);
    if (existing) {
      existing.count += group._count._all;
    } else {
      makeMap.set(key, { name, count: group._count._all });
    }
  }

  const makes = [...makeMap.values()].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name),
  );

  return {
    makes,
    price: {
      min: priceAggregate._min[rateField] ?? 0,
      max: priceAggregate._max[rateField] ?? 0,
    },
  };
}

/**
 * Creates error response with empty data
 */
function createErrorResponse(status: number) {
  return data(
    {
      cars: [],
      ratings: {},
      filters: {
        serviceTiers: [] as ServiceTier[],
        vehicleTypes: [] as VehicleType[],
        bookingType: null,
        partnerSlug: null,
      },
      facets: null,
      pagination: {
        page: 1,
        limit: 12,
        total: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * Calculates pagination metadata
 *
 * hasNextPage logic:
 * - hasMoreAfterFiltering: the over-fetched batch had more than `limit` cars after availability filtering
 * - dbHasMore: the DB returned as many records as we asked for, indicating more might exist
 *
 * We use dbHasMore instead of totalPages because totalCount is pre-availability-filtering,
 * which doesn't reliably indicate post-filtering pagination boundaries.
 */
function calculatePagination(
  totalCount: number,
  limit: number,
  page: number,
  returnedCars: unknown[],
  hasMoreAfterFiltering: boolean,
  dbHasMore: boolean,
) {
  const totalPages = Math.ceil(totalCount / limit);
  const hasNextPage = hasMoreAfterFiltering || (returnedCars.length === limit && dbHasMore);
  const hasPreviousPage = page > 1;

  return {
    page,
    limit,
    total: totalCount,
    totalPages,
    hasNextPage,
    hasPreviousPage,
  };
}

export async function loader({ request, params: routeParams }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const params = parseSearchParams(url);

  // Validate booking type if provided
  if (params.bookingType && !isBookingType(params.bookingType)) {
    logger.warn("[SEARCH] Invalid booking type", { bookingType: params.bookingType });
    return createErrorResponse(400);
  }

  const normalizedPartnerSlug = routeParams.slug?.trim().toLowerCase();

  try {
    const startTime = Date.now();
    const partner = normalizedPartnerSlug
      ? await getPublicPartnerBySlug(normalizedPartnerSlug)
      : null;

    if (normalizedPartnerSlug && !partner) {
      return createErrorResponse(404);
    }

    logger.info("[SEARCH] Query params", {
      q: url.searchParams.get("q"),
      filters: params.filters,
      color: params.colorParam,
      model: params.modelParam,
      from: params.from,
      to: params.to,
      bookingType: params.bookingType,
      pickupTime: params.pickupTime,
      flightNumber: params.flightNumber,
      makeModelQuery: params.makeModelQuery,
      partnerSlug: normalizedPartnerSlug,
    });

    // Parse page parameter for pagination
    const pageParam = url.searchParams.get("page");
    const page = pageParam ? Math.max(1, Number.parseInt(pageParam, 10)) : 1;
    const limit = 12;
    const overFetchMultiplier = 1.5; // Fetch 18 cars to account for filtering
    const take = Math.ceil(limit * overFetchMultiplier);
    const skip = (page - 1) * limit;

    // Get unavailable fleet owners for the date
    const fleetOwnersToExclude = params.from
      ? await getFleetOwnersWithNoChauffeursOrAllChauffeursBusy(new Date(params.from))
      : [];

    const fleetOwnerQueryTime = Date.now() - startTime;
    logger.info("[SEARCH] Fleet owners query completed", { ms: fleetOwnerQueryTime });

    const carQueryStartTime = Date.now();

    const rateField = getRateFieldForBookingType(params.bookingType);

    // Build where clause for count and findMany (same conditions)
    const whereClause = buildCarWhereClause({
      fleetOwnersToExclude,
      partnerOwnerId: partner?.id,
      filters: params.filters,
      rateField,
      colorParam: params.colorParam,
      modelParam: params.modelParam,
      makeModelQuery: params.makeModelQuery,
    });

    // Lightweight count-only mode used by the filter panel for live result counts
    if (url.searchParams.get("countOnly") === "1") {
      const total = await prisma.car.count({ where: whereClause });
      return data(
        {
          cars: [],
          ratings: {},
          filters: {
            serviceTiers: params.filters.serviceTiers,
            vehicleTypes: params.filters.vehicleTypes,
            bookingType: params.bookingType ?? null,
            partnerSlug: partner?.publicSlug ?? null,
          },
          facets: null,
          pagination: {
            page: 1,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            hasNextPage: false,
            hasPreviousPage: false,
          },
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const baseVisibilityWhere: Prisma.CarWhereInput = {
      AND: buildBaseVisibilityClauses({
        fleetOwnersToExclude,
        partnerOwnerId: partner?.id,
      }),
    };

    // Get total count BEFORE availability filtering (for consistent pagination),
    // plus facet data for the filter panel
    const [totalCount, facets] = await Promise.all([
      prisma.car.count({ where: whereClause }),
      getSearchFacets(baseVisibilityWhere, rateField),
    ]);

    // Build where clause with category filters and optional make/model search
    const cars = await prisma.car.findMany({
      where: whereClause,
      include: {
        owner: { select: { username: true, name: true } },
        images: {
          select: { url: true },
          orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
          take: 4,
        },
        documents: {
          select: {
            id: true,
            documentType: true,
            documentUrl: true,
            status: true,
            notes: true,
            userId: true,
            carId: true,
            approvedById: true,
            createdAt: true,
            updatedAt: true,
            approvedAt: true,
          },
          take: 1,
        },
      },
      orderBy: [{ updatedAt: "desc" }, { dayRate: "asc" }],
      skip,
      take,
    });

    // Apply availability filtering if all required params are present
    const filteredCars = await filterCarsByAvailability(cars, {
      from: params.from,
      to: params.to,
      bookingType: params.bookingType,
      pickupTime: params.pickupTime,
      flightNumber: params.flightNumber,
    });

    // Return only up to limit, but track if there are more after filtering
    const returnedCars = filteredCars.slice(0, limit);
    const hasMoreAfterFiltering = filteredCars.length > limit;
    // DB returned everything we asked for, so there might be more pages
    const dbHasMore = cars.length === take;

    const carQueryTime = Date.now() - carQueryStartTime;

    // Fetch ratings and promotions for all filtered cars in parallel
    let ratings: Record<string, AggregatedRatings> = {};
    let promoMap = new Map<string, ActivePromotion>();
    try {
      const carIds = returnedCars.map((car) => car.id);
      const carsForPromo = returnedCars.map((c) => ({ id: c.id, ownerId: c.ownerId }));

      const [ratingsResult, promoResult] = await Promise.all([
        getBatchCarRatings(carIds),
        getActivePromotionsForCars(carsForPromo),
      ]);
      ratings = ratingsResult;
      promoMap = promoResult;
    } catch (error) {
      logger.error("[SEARCH] Error fetching ratings/promotions", { error });
    }

    // Enrich cars with promotion fields so they travel with the car through infinite scroll
    const enrichedCars = returnedCars.map((car) => {
      const promo = promoMap.get(car.id);
      if (!promo) return { ...car, isOnPromotion: false as const };

      return {
        ...car,
        isOnPromotion: true as const,
        promotionLabel: getPromotionBadgeLabel(promo),
        promotionDiscountPercent: Number(promo.discountValue),
      };
    });

    const totalTime = Date.now() - startTime;
    logger.info("[SEARCH] Query completed", { ms: carQueryTime, totalMs: totalTime });

    const pagination = calculatePagination(
      totalCount,
      limit,
      page,
      returnedCars,
      hasMoreAfterFiltering,
      dbHasMore,
    );

    return data(
      {
        cars: enrichedCars,
        ratings,
        filters: {
          serviceTiers: params.filters.serviceTiers,
          vehicleTypes: params.filters.vehicleTypes,
          bookingType: params.bookingType ?? null,
          partnerSlug: partner?.publicSlug ?? null,
        },
        facets,
        pagination,
      },
      {
        headers: {
          "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
          Vary: "Accept-Encoding",
          "X-Total-Time": `${totalTime}ms`,
        },
      },
    );
  } catch (error) {
    logger.error("[SEARCH] Error:", error instanceof Error ? error.message : "Unknown error");
    return createErrorResponse(500);
  }
}

/** Result-heading nouns per vehicle type, e.g. "6 sedans" / "1 sedan" */
const vehicleTypeNouns: Record<VehicleType, { singular: string; plural: string }> = {
  SEDAN: { singular: "sedan", plural: "sedans" },
  SUV: { singular: "SUV", plural: "SUVs" },
  VAN: { singular: "van / minibus", plural: "vans / minibuses" },
  CROSSOVER: { singular: "crossover", plural: "crossovers" },
};

function buildResultsHeading(total: number, vehicleTypes: VehicleType[]): string {
  const form = total === 1 ? "singular" : "plural";

  if (vehicleTypes.length === 0) {
    return `${total} ${total === 1 ? "vehicle" : "vehicles"}`;
  }

  // Join all selected types: "23 SUVs and sedans", "1 SUV or sedan"
  const nouns = vehicleTypes.map((type) => vehicleTypeNouns[type][form]);
  const conjunction = total === 1 ? " or " : " and ";
  const joined =
    nouns.length > 1 ? `${nouns.slice(0, -1).join(", ")}${conjunction}${nouns.at(-1)}` : nouns[0];

  return `${total} ${joined}`;
}

type SearchCar = SerializedCar &
  (
    | { isOnPromotion: false }
    | { isOnPromotion: true; promotionLabel: string; promotionDiscountPercent: number }
  );

type LoaderData = {
  cars: SearchCar[];
  ratings: Record<string, AggregatedRatings>;
  filters: {
    serviceTiers: ServiceTier[];
    vehicleTypes: VehicleType[];
    bookingType: string | null;
    partnerSlug: string | null;
  };
  facets: SearchFacets | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

export default function SearchPage() {
  const { cars, ratings, filters, facets, pagination } = useLoaderData<LoaderData>();
  const [searchParams] = useSearchParams();
  const { slug: routePartnerSlug } = useParams();
  const matches = useMatches();
  const effectivePartnerSlug = routePartnerSlug ?? filters.partnerSlug ?? null;
  const searchBasePath = effectivePartnerSlug
    ? `/partners/${effectivePartnerSlug}/search`
    : "/search";
  const carDetailsBasePath = effectivePartnerSlug
    ? `/partners/${effectivePartnerSlug}/cars`
    : "/cars";

  // Get domain from root loader data
  const rootData = matches.find((match) => match.id === "root")?.data as
    | { ENV?: { DOMAIN?: string } }
    | undefined;
  const baseUrl = rootData?.ENV?.DOMAIN ?? "http://localhost:5173";

  // Mobile search modal state
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  // A pending navigation to this same search page means new results are on
  // their way (filters applied/cleared, search changed) — show skeletons.
  // Navigations elsewhere (e.g. into a car's details) keep the results visible.
  const navigation = useNavigation();
  const isUpdatingResults =
    navigation.state === "loading" && navigation.location.pathname === searchBasePath;

  // Infinite scroll hook
  const {
    allItems: allCars,
    allRatings,
    hasMore,
    fetchError,
    isLoading,
    sentinelRef,
    initialItemsCount,
    retry,
  } = useInfiniteScroll({
    initialItems: cars,
    initialRatings: ratings,
    initialPagination: pagination,
    searchParams,
    searchPath: searchBasePath,
  });

  // Parse URL params for display
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const bookingTypeParam = searchParams.get("bookingType");

  // Validate booking type
  const validBookingTypes = ["DAY", "NIGHT", "FULL_DAY", "AIRPORT_PICKUP"] as const;
  type ClientBookingType = (typeof validBookingTypes)[number];
  const isValidBookingType = (value: string | null): value is ClientBookingType =>
    !!value && (validBookingTypes as readonly string[]).includes(value);
  const bookingType = isValidBookingType(bookingTypeParam) ? bookingTypeParam : "DAY";

  const getRateForBookingType = useCallback(
    (car: SerializedCar) => {
      switch (bookingType) {
        case NIGHT_BOOKING_TYPE:
          return car.nightRate;
        case FULL_DAY_BOOKING_TYPE:
          return car.fullDayRate;
        case AIRPORT_PICKUP_BOOKING_TYPE:
          return car.airportPickupRate;
        default:
          return car.dayRate;
      }
    },
    [bookingType],
  );

  const totalUnits = calculateBookingUnits(from, to, bookingType);
  const hasDateFilters = !!(from && to);
  const activeFilterCount = useMemo(
    () => countActiveSearchFilters(parseSearchFilters(searchParams)),
    [searchParams],
  );
  const hasActiveFilters = activeFilterCount > 0;
  const resultsHeading = buildResultsHeading(
    pagination?.total ?? allCars.length,
    filters.vehicleTypes,
  );

  // Clear all category filters
  const clearAllFiltersPath = useMemo(() => {
    const params = new URLSearchParams(searchParams);
    for (const key of SEARCH_FILTER_PARAM_KEYS) {
      params.delete(key);
    }
    const query = params.toString();
    return query ? `${searchBasePath}?${query}` : searchBasePath;
  }, [searchParams, searchBasePath]);

  return (
    <div className="min-h-screen">
      {/* Fixed Header with Search - positioned below main navbar */}
      <div className="fixed top-0 md:top-[69px] left-0 right-0 z-30 bg-white border-b-0 md:border-b md:border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          {/* Desktop: Search bar */}
          <div className="hidden md:block max-w-4xl mx-auto">
            <BookingSearchDraftProvider>
              <BookingSearch isCompact={true} searchBasePath={searchBasePath} />
            </BookingSearchDraftProvider>
          </div>

          {/* Mobile: Compact search bar */}
          <div className="md:hidden">
            <CompactSearchBar onClick={() => setIsSearchModalOpen(true)} />
          </div>
        </div>
      </div>

      {/* Mobile Search Modal — mount only when open so controls are not left in an aria-hidden subtree */}
      {isSearchModalOpen && (
        <SearchModal
          isOpen
          onClose={() => setIsSearchModalOpen(false)}
          searchBasePath={searchBasePath}
        />
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto my-24">
        {/* Results Header */}
        <div className="flex items-center justify-between gap-4 py-4">
          <h1 className="font-semibold">
            {isUpdatingResults ? <Skeleton className="h-5 w-32" /> : resultsHeading}
          </h1>
          <SearchFilters
            facets={facets}
            searchBasePath={searchBasePath}
            bookingType={bookingType}
            activeFilterCount={activeFilterCount}
          />
        </div>

        {/* Hidden pagination links for SEO */}
        {pagination && (
          <PaginationControl
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            hasNextPage={pagination.hasNextPage}
            hasPreviousPage={pagination.hasPreviousPage}
            searchParams={searchParams}
            baseUrl={baseUrl}
          />
        )}

        {isUpdatingResults && <CarSkeleton count={6} grid={true} />}

        {!isUpdatingResults && allCars.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {allCars.map((car, index) => {
                const originalRate = getRateForBookingType(car);
                const displayRate = car.isOnPromotion
                  ? Math.max(1, originalRate * (1 - car.promotionDiscountPercent / 100))
                  : originalRate;

                return (
                  <CarCard
                    key={car.id}
                    car={car}
                    detailsBasePath={carDetailsBasePath}
                    searchParams={searchParams}
                    priority={index < 6}
                    price={displayRate}
                    originalPrice={car.isOnPromotion ? originalRate : undefined}
                    isOnPromotion={car.isOnPromotion}
                    promotionLabel={car.isOnPromotion ? car.promotionLabel : undefined}
                    showTotal={hasDateFilters}
                    totalPrice={hasDateFilters ? displayRate * totalUnits : undefined}
                    variant="grid"
                    ratings={allRatings[car.id]}
                  />
                );
              })}
            </div>
            {hasMore && <div ref={sentinelRef} className="h-1" aria-hidden="true" />}
          </>
        )}

        {!isUpdatingResults && allCars.length === 0 && (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
            <div className="max-w-md mx-auto">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No vehicles found</h3>
              <p className="text-gray-600 mb-6">
                {hasActiveFilters
                  ? "Try removing some filters or adjusting your search criteria."
                  : "Try adjusting your dates or search criteria."}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                {hasActiveFilters && (
                  <Button variant="outline" asChild>
                    <Link to={clearAllFiltersPath}>Clear filters</Link>
                  </Button>
                )}
                <Button asChild>
                  <Link to="/">Browse all vehicles</Link>
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Loading state during fetch */}
        {!isUpdatingResults && hasMore && isLoading && (
          <div className="mt-6">
            <CarSkeleton count={3} grid={true} />
          </div>
        )}

        {/* Error state */}
        {fetchError && (
          <div className="text-center py-4 mt-6">
            <p className="text-sm text-red-600 mb-2">{fetchError}</p>
            <Button variant="outline" size="sm" onClick={retry}>
              Retry
            </Button>
          </div>
        )}

        {/* No more results message */}
        {!isUpdatingResults && !hasMore && allCars.length > initialItemsCount && (
          <div className="text-center py-8 text-sm text-gray-500 mt-6">
            You&apos;ve reached the end of available vehicles
          </div>
        )}
      </div>
    </div>
  );
}
