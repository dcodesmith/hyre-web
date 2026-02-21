import {
  type Booking,
  BookingStatus,
  BookingType,
  type Car,
  CarApprovalStatus,
  Prisma,
  Status,
} from "@prisma/client";
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { data } from "@remix-run/node";
import { Link, useLoaderData, useMatches, useSearchParams } from "@remix-run/react";
import { fromZonedTime } from "date-fns-tz";
import { useCallback, useState } from "react";

import { BookingSearch, BookingSearchDraftProvider } from "~/components/BookingSearch";
import { CarCard } from "~/components/CarCard";
import { CarSkeleton } from "~/components/CarSkeleton";
import { CompactSearchBar } from "~/components/CompactSearchBar";
import { PaginationControl } from "~/components/PaginationControl";
import { SearchModal } from "~/components/SearchModal";
import { useInfiniteScroll } from "~/hooks/useInfiniteScroll";
import {
  AIRPORT_PICKUP_BOOKING_TYPE,
  BOOKING_TYPE_OPTIONS,
  BOOKING_TYPE_OPTIONS_MAP,
  FULL_DAY_BOOKING_TYPE,
  NIGHT_BOOKING_TYPE,
} from "~/components/bookingTypes";
import { Button } from "~/components/ui/button";
import { calculateBookingUnits } from "~/lib/booking-utils";
import logger from "~/lib/logger.server";
import { prisma } from "~/modules/db/db.server";
import { availableCarsForSpecificRequest } from "~/services/availability-engine.server";
import { validateFlight } from "~/services/flight-validation.server";
import { getBatchCarRatings } from "~/services/reviews.server";
import type { AggregatedRatings } from "~/services/reviews.server";
import type { SerializedCar, ServiceTier, VehicleType } from "~/types";
import {
  SERVICE_TIERS,
  ServiceTiers,
  VEHICLE_TYPES,
  VehicleTypes,
  serviceTierLabels,
  vehicleTypeLabels,
} from "~/types";
import { LAGOS_TIMEZONE } from "~/utils/timezone";
import { generateMetaTags } from "~/utils/seo";

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

/**
 * Type guards for enum validation
 */
function isServiceTier(value: string): value is ServiceTier {
  return (SERVICE_TIERS as readonly string[]).includes(value);
}

function isVehicleType(value: string): value is VehicleType {
  return (VEHICLE_TYPES as readonly string[]).includes(value);
}

/**
 * Validates and parses enum params from URL
 */
function parseServiceTier(value: string | null): ServiceTier | undefined {
  if (!value) return undefined;
  const upperValue = value.toUpperCase();
  return isServiceTier(upperValue) ? upperValue : undefined;
}

function parseVehicleType(value: string | null): VehicleType | undefined {
  if (!value) return undefined;
  const upperValue = value.toUpperCase();
  return isVehicleType(upperValue) ? upperValue : undefined;
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
 * Generate dynamic meta tags based on search filters
 */
export const meta: MetaFunction<typeof loader> = ({ data, matches, location }) => {
  // Access root loader data
  const rootData = matches.find((match) => match.id === "root")?.data as
    | { ENV?: { DOMAIN?: string } }
    | undefined;

  const filters = data?.filters;
  const pagination = data?.pagination;
  const baseUrl = rootData?.ENV?.DOMAIN ?? "http://localhost:5173";

  // Build dynamic title parts
  const titleParts: string[] = [];
  let descriptionContext = "";

  if (filters?.vehicleType) {
    const vehicleLabel = vehicleTypeLabels[filters.vehicleType] || filters.vehicleType;
    titleParts.push(vehicleLabel);
    descriptionContext += `${vehicleLabel} vehicles`;
  }

  if (filters?.serviceTier) {
    const tierLabel = serviceTierLabels[filters.serviceTier] || filters.serviceTier;
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
    url: `${baseUrl}/search`,
    image: `${baseUrl}/og-image.jpg`,
    canonical: `${baseUrl}/search`,
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
        href: `${baseUrl}/search?${nextParams.toString()}`,
      });
    }

    if (pagination.hasPreviousPage) {
      const prevParams = new URLSearchParams(location.search);
      prevParams.set("page", (currentPage - 1).toString());

      tags.push({
        tagName: "link",
        rel: "prev",
        href: `${baseUrl}/search?${prevParams.toString()}`,
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
  let serviceTierParam = url.searchParams.get("serviceTier");
  let vehicleTypeParam = url.searchParams.get("vehicleType");
  const colorParam = url.searchParams.get("color");
  const makeParam = url.searchParams.get("make");
  const modelParam = url.searchParams.get("model");

  let extractedMakeModelQuery: string | undefined;

  if (q && !serviceTierParam && !vehicleTypeParam) {
    const mappedFilters = mapQueryToFilters(q);
    if (mappedFilters.vehicleType) {
      vehicleTypeParam = mappedFilters.vehicleType;
    }
    if (mappedFilters.serviceTier) {
      serviceTierParam = mappedFilters.serviceTier;
    }
    extractedMakeModelQuery = mappedFilters.remainingQuery;
  }

  const serviceTier = parseServiceTier(serviceTierParam);
  const vehicleType = parseVehicleType(vehicleTypeParam);
  const makeModelQuery =
    extractedMakeModelQuery?.trim() || (q && !serviceTier && !vehicleType ? q.trim() : null);

  return {
    serviceTier,
    vehicleType,
    colorParam,
    makeParam,
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
 * Builds Prisma where clause for car search
 */
function buildCarWhereClause(params: {
  fleetOwnersToExclude: string[];
  serviceTier: ServiceTier | undefined;
  vehicleType: VehicleType | undefined;
  colorParam: string | null;
  makeParam: string | null;
  modelParam: string | null;
  makeModelQuery: string | null;
}): Prisma.CarWhereInput {
  return {
    AND: [
      {
        ...(params.fleetOwnersToExclude.length > 0 && {
          ownerId: { notIn: params.fleetOwnersToExclude },
        }),
        status: { in: [Status.AVAILABLE, Status.BOOKED] },
        approvalStatus: { in: [CarApprovalStatus.APPROVED] },
        owner: { fleetOwnerStatus: "APPROVED", hasOnboarded: true },
        ...(params.serviceTier && { serviceTier: params.serviceTier }),
        ...(params.vehicleType && { vehicleType: params.vehicleType }),
        ...(params.colorParam && {
          color: { contains: params.colorParam, mode: Prisma.QueryMode.insensitive },
        }),
        ...(params.makeParam && {
          make: { contains: params.makeParam, mode: Prisma.QueryMode.insensitive },
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
    ],
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
      filters: { serviceTier: null, vehicleType: null, bookingType: null },
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

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const params = parseSearchParams(url);

  // Validate booking type if provided
  if (params.bookingType && !isBookingType(params.bookingType)) {
    logger.warn("[SEARCH] Invalid booking type", { bookingType: params.bookingType });
    return createErrorResponse(400);
  }

  logger.info("[SEARCH] Query params", {
    q: url.searchParams.get("q"),
    serviceTier: params.serviceTier,
    vehicleType: params.vehicleType,
    color: params.colorParam,
    make: params.makeParam,
    model: params.modelParam,
    from: params.from,
    to: params.to,
    bookingType: params.bookingType,
    pickupTime: params.pickupTime,
    flightNumber: params.flightNumber,
    makeModelQuery: params.makeModelQuery,
  });

  try {
    const startTime = Date.now();

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

    // Build where clause for count and findMany (same conditions)
    const whereClause = buildCarWhereClause({
      fleetOwnersToExclude,
      serviceTier: params.serviceTier,
      vehicleType: params.vehicleType,
      colorParam: params.colorParam,
      makeParam: params.makeParam,
      modelParam: params.modelParam,
      makeModelQuery: params.makeModelQuery,
    });

    // Get total count BEFORE availability filtering (for consistent pagination)
    const totalCount = await prisma.car.count({ where: whereClause });

    // Build where clause with category filters and optional make/model search
    const cars = await prisma.car.findMany({
      where: whereClause,
      include: {
        owner: { select: { username: true, name: true } },
        images: { select: { url: true }, orderBy: { createdAt: "asc" }, take: 4 },
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

    // Fetch ratings for all filtered cars in a single batch query
    let ratings: Record<string, AggregatedRatings> = {};
    try {
      const carIds = returnedCars.map((car) => car.id);
      ratings = await getBatchCarRatings(carIds);
    } catch (error) {
      logger.error("[SEARCH] Error fetching ratings", { error });
      // Continue without ratings if there's an error
    }

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
        cars: returnedCars,
        ratings,
        filters: {
          serviceTier: params.serviceTier ?? null,
          vehicleType: params.vehicleType ?? null,
          bookingType: params.bookingType ?? null,
        },
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

type LoaderData = {
  cars: SerializedCar[];
  ratings: Record<string, AggregatedRatings>;
  filters: {
    serviceTier: ServiceTier | null;
    vehicleType: VehicleType | null;
    bookingType: string | null;
  };
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
  const { cars, ratings, filters, pagination } = useLoaderData<LoaderData>();
  const [searchParams] = useSearchParams();
  const matches = useMatches();

  // Get domain from root loader data
  const rootData = matches.find((match) => match.id === "root")?.data as
    | { ENV?: { DOMAIN?: string } }
    | undefined;
  const baseUrl = rootData?.ENV?.DOMAIN ?? "http://localhost:5173";

  // Mobile search modal state
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

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
  const hasActiveFilters = !!(filters.serviceTier || filters.vehicleType);

  // Clear all category filters
  const clearAllFilters = () => {
    const params = new URLSearchParams(searchParams);
    params.delete("serviceTier");
    params.delete("vehicleType");
    return `/search?${params.toString()}`;
  };

  return (
    <div className="min-h-screen">
      {/* Fixed Header with Search - positioned below main navbar */}
      <div className="fixed top-0 md:top-[69px] left-0 right-0 z-30 bg-white border-b-0 md:border-b md:border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          {/* Desktop: Search bar */}
          <div className="hidden md:block max-w-4xl mx-auto">
            <BookingSearchDraftProvider>
              <BookingSearch isCompact={true} />
            </BookingSearchDraftProvider>
          </div>

          {/* Mobile: Compact search bar */}
          <div className="md:hidden">
            <CompactSearchBar onClick={() => setIsSearchModalOpen(true)} />
          </div>
        </div>
      </div>

      {/* Mobile Search Modal */}
      <SearchModal isOpen={isSearchModalOpen} onClose={() => setIsSearchModalOpen(false)} />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto my-24">
        {/* Results Header */}
        <h4 className="py-4 font-semibold">
          {pagination?.total ?? allCars.length}{" "}
          {serviceTierLabels[filters.serviceTier ?? ServiceTiers.STANDARD]}{" "}
          {vehicleTypeLabels[filters.vehicleType ?? VehicleTypes.SEDAN]}{" "}
          {(pagination?.total ?? allCars.length) === 1 ? "vehicle" : "vehicles"} found
        </h4>

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

        {allCars.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {allCars.map((car, index) => (
                <CarCard
                  key={car.id}
                  car={car}
                  searchParams={searchParams}
                  priority={index < 6}
                  price={getRateForBookingType(car)}
                  showTotal={hasDateFilters}
                  totalPrice={hasDateFilters ? getRateForBookingType(car) * totalUnits : undefined}
                  variant="grid"
                  ratings={allRatings[car.id]}
                />
              ))}
            </div>
            {hasMore && <div ref={sentinelRef} className="h-1" aria-hidden="true" />}
          </>
        ) : (
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
                    <Link to={clearAllFilters()}>Clear filters</Link>
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
        {hasMore && isLoading && (
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
        {!hasMore && allCars.length > initialItemsCount && (
          <div className="text-center py-8 text-sm text-gray-500 mt-6">
            You&apos;ve reached the end of available vehicles
          </div>
        )}
      </div>
    </div>
  );
}
