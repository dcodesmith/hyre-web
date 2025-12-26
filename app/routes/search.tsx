import {
  type Booking,
  BookingStatus,
  BookingType,
  type Car,
  CarApprovalStatus,
  Status,
} from "@prisma/client";
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { data } from "@remix-run/node";
import { Link, useLoaderData, useSearchParams } from "@remix-run/react";
import { fromZonedTime } from "date-fns-tz";
import { useCallback, useState } from "react";

import { BookingSearch } from "~/components/BookingSearch";
import { CarCard } from "~/components/CarCard";
import { CompactSearchBar } from "~/components/CompactSearchBar";
import { SearchModal } from "~/components/SearchModal";
import {
  AIRPORT_PICKUP_BOOKING_TYPE,
  BOOKING_TYPE_OPTIONS,
  FULL_DAY_BOOKING_TYPE,
  NIGHT_BOOKING_TYPE,
} from "~/components/bookingTypes";
import { Button } from "~/components/ui/button";
import { calculateBookingUnits } from "~/lib/booking-utils";
import logger from "~/lib/logger.server";
import { prisma } from "~/modules/db/db.server";
import { availableCarsForSpecificRequest } from "~/services/availability-engine.server";
import { validateFlight } from "~/services/flight-validation.server";
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

export const meta: MetaFunction = () => [
  {
    title: "Search Available Cars - Tripdly",
  },
  {
    name: "description",
    content:
      "Search and book available luxury vehicles with professional chauffeurs in Nigeria. Filter by date, vehicle type, and service tier. Find the perfect car for your trip.",
  },
  {
    property: "og:title",
    content: "Search Available Cars - Tripdly",
  },
  {
    property: "og:description",
    content:
      "Search and book available luxury vehicles with professional chauffeurs in Nigeria. Filter by date, vehicle type, and service tier.",
  },
    {
      property: "og:type",
      content: "website",
    },
    {
      property: "og:url",
      content: "https://tripdly.com",
    },
    {
      property: "og:image",
      content: "https://tripdly.com/og-image.png",
    },
    {
      name: "twitter:image",
      content: "https://tripdly.com/og-image.png",
    },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);

  // Category/type filters
  const serviceTierParam = url.searchParams.get("serviceTier");
  const vehicleTypeParam = url.searchParams.get("vehicleType");

  // Date/availability filters
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const bookingType = url.searchParams.get("bookingType");
  const pickupTime = url.searchParams.get("pickupTime");
  const flightNumber = url.searchParams.get("flightNumber");

  // Validate booking type if provided
  if (bookingType && !isBookingType(bookingType)) {
    logger.warn("[SEARCH] Invalid booking type", { bookingType });
    return data(
      { cars: [], filters: { serviceTier: null, vehicleType: null } },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  // Parse enum filters
  const serviceTier = parseServiceTier(serviceTierParam);
  const vehicleType = parseVehicleType(vehicleTypeParam);

  logger.info("[SEARCH] Query params", {
    serviceTier,
    vehicleType,
    from,
    to,
    bookingType,
    pickupTime,
    flightNumber,
  });

  try {
    const startTime = Date.now();

    // Get unavailable fleet owners for the date
    const fleetOwnersToExclude = from
      ? await getFleetOwnersWithNoChauffeursOrAllChauffeursBusy(new Date(from))
      : [];

    const fleetOwnerQueryTime = Date.now() - startTime;
    logger.info("[SEARCH] Fleet owners query completed", { ms: fleetOwnerQueryTime });

    const carQueryStartTime = Date.now();

    // Build where clause with category filters
    const cars = await prisma.car.findMany({
      where: {
        AND: [
          {
            ...(fleetOwnersToExclude.length > 0 && {
              ownerId: { notIn: fleetOwnersToExclude },
            }),
            status: { in: [Status.AVAILABLE, Status.BOOKED] },
            approvalStatus: { in: [CarApprovalStatus.APPROVED] },
            owner: { fleetOwnerStatus: "APPROVED", hasOnboarded: true },
            // Category filters - only applied if provided
            ...(serviceTier && { serviceTier }),
            ...(vehicleType && { vehicleType }),
          },
        ],
      },
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
      take: 100,
    });

    // Apply availability filtering if all required params are present
    const filteredCars = await filterCarsByAvailability(cars, {
      from,
      to,
      bookingType,
      pickupTime,
      flightNumber,
    });

    const carQueryTime = Date.now() - carQueryStartTime;
    const totalTime = Date.now() - startTime;
    logger.info("[SEARCH] Query completed", { ms: carQueryTime, totalMs: totalTime });

    return data(
      {
        cars: filteredCars,
        filters: {
          serviceTier: serviceTier ?? null,
          vehicleType: vehicleType ?? null,
        },
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
    return data(
      { cars: [], filters: { serviceTier: null, vehicleType: null } },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

type LoaderData = {
  cars: SerializedCar[];
  filters: {
    serviceTier: ServiceTier | null;
    vehicleType: VehicleType | null;
  };
};

export default function SearchPage() {
  const { cars, filters } = useLoaderData<LoaderData>();
  const [searchParams] = useSearchParams();

  // Mobile search modal state
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

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
      <div className="fixed top-0 md:top-[65px] left-0 right-0 z-30 bg-white border-b-0 md:border-b md:border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          {/* Desktop: Search bar */}
          <div className="hidden md:block max-w-4xl mx-auto">
            <BookingSearch isCompact={true} />
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
          {cars.length} {serviceTierLabels[filters.serviceTier ?? ServiceTiers.STANDARD]}{" "}
          {vehicleTypeLabels[filters.vehicleType ?? VehicleTypes.SEDAN]}{" "}
          {cars.length === 1 ? "vehicle" : "vehicles"} found
        </h4>

        {cars.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cars.map((car, index) => (
              <CarCard
                key={car.id}
                car={car}
                searchParams={searchParams}
                priority={index < 6}
                price={getRateForBookingType(car)}
                showTotal={hasDateFilters}
                totalPrice={hasDateFilters ? getRateForBookingType(car) * totalUnits : undefined}
                variant="grid"
              />
            ))}
          </div>
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
      </div>
    </div>
  );
}
