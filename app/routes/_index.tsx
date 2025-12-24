import {
  type Booking,
  BookingStatus,
  BookingType,
  type Car,
  CarApprovalStatus,
  Status,
} from "@prisma/client";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { data } from "@remix-run/node";
import { Link, useLoaderData, useSearchParams } from "@remix-run/react";
import { fromZonedTime } from "date-fns-tz";
import { Fingerprint, LocateFixed, ShieldCheck } from "lucide-react";
import { BookingSearch } from "~/components/BookingSearch";

import logger from "~/lib/logger.server";
import { prisma } from "~/modules/db/db.server";
import { availableCarsForSpecificRequest } from "~/services/availability-engine.server";
import { LAGOS_TIMEZONE } from "~/utils/timezone";

import { useCallback, useState } from "react";
import { CarCard } from "~/components/CarCard";
import { CarouselSection } from "~/components/CarouselSection";
import { CompactSearchBar } from "~/components/CompactSearchBar";
import { SearchModal } from "~/components/SearchModal";
import {
  AIRPORT_PICKUP_BOOKING_TYPE,
  FULL_DAY_BOOKING_TYPE,
  NIGHT_BOOKING_TYPE,
} from "~/components/bookingTypes";
import { useIsMobile } from "~/hooks/use-mobile";
import { useCarCategories } from "~/hooks/useCarCategories";
import { getHeroHeightClasses, useHeroScroll } from "~/hooks/useHeroScroll";
import { calculateBookingUnits } from "~/lib/booking-utils";
import { validateFlight } from "~/services/flight-validation.server";
import type { SerializedCar } from "~/types";

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
 * Validates an airport pickup flight and calculates the pickup/dropoff window.
 */
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

// Preload hero image only for home page - use WebP with responsive fallback
export const links = () => [
  {
    rel: "preload",
    href: "/images/hero.webp",
    as: "image",
    type: "image/webp",
    media: "(min-width: 1024px)",
  },
  {
    rel: "preload",
    href: "/images/hero-1200.webp",
    as: "image",
    type: "image/webp",
    media: "(min-width: 768px) and (max-width: 1023px)",
  },
  { rel: "preload", href: "/images/hero.png", as: "image", type: "image/png" },
];

/**
 * Retrieves the IDs of fleet owners who are effectively 'unavailable'
 * on a specific date. This includes owners who have no chauffeurs,
 * or whose all chauffeurs are busy with confirmed/active bookings
 * that fully or partially overlap with the specified date.
 *
 * @param specificDateInput The date for which to check availability. Defaults to the current date in UTC.
 * @returns A promise that resolves to an array of unique fleet owner IDs (string[]).
 */
async function getFleetOwnersWithNoChauffeursOrAllChauffeursBusy(
  specificDateInput: Date = new Date(),
): Promise<string[]> {
  // Use UTC methods to get the year, month, and day from the input Date object.
  // This ensures that we correctly define the day in UTC, regardless of the
  // local timezone of the server or the time component of the input Date.
  const year = specificDateInput.getUTCFullYear();
  const month = specificDateInput.getUTCMonth(); // JavaScript months are 0-indexed (0 for January, 11 for December)
  const day = specificDateInput.getUTCDate();

  // Create Date objects for the very start and very end of that day in UTC.
  // Using 0 for milliseconds for the start and 999 for the end to cover the full range of the day.
  const startDateAtTargetDate = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  const endDateAtTargetDate = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));

  // Find fleet owners who either have no chauffeurs or all chauffeurs are busy
  // Note: Owner-drivers (isOwnerDriver: true) are excluded because they drive themselves
  const fleetOwnersWithNoChauffeursOrAllChauffeursBusy = await prisma.user.findMany({
    where: {
      // Condition: The user must be a fleet owner (i.e., owns at least one car)
      cars: {
        some: {},
      },
      // Exclude owner-drivers - they drive their own vehicles
      isOwnerDriver: false,
      // Condition: User is unavailable if one of the following is true:
      OR: [
        {
          // Case 1: Fleet owner has no chauffeurs at all
          chauffeurs: {
            none: {},
          },
        },
        {
          // Case 2: Fleet owner has chauffeurs, and ALL of them are busy
          // Note: 'some: {}' here ensures the user actually has chauffeurs before checking 'every'
          chauffeurs: {
            some: {},
            every: {
              // A chauffeur is busy if they have at least one booking meeting the criteria
              bookingsAsChauffeur: {
                some: {
                  status: {
                    // Define booking statuses that consider a chauffeur 'busy'
                    in: ["PENDING", "CONFIRMED", "ACTIVE"],
                  },
                  // Crucial check for overlap with the specific target day (entire day in UTC)
                  // A booking [B_start, B_end] overlaps with target day [T_start, T_end] if:
                  // B_start <= T_end AND B_end >= T_start
                  AND: [
                    {
                      startDate: {
                        lte: endDateAtTargetDate, // Booking starts on or before the end of the target day
                      },
                    },
                    {
                      endDate: {
                        gte: startDateAtTargetDate, // Booking ends on or after the start of the target day
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      ],
    },
    select: {
      id: true,
    },
    distinct: ["id"],
    // Add ordering for consistent results
    orderBy: { id: "asc" },
  });

  logger.info(
    `Found ${fleetOwnersWithNoChauffeursOrAllChauffeursBusy.length} fleet owners with no chauffeurs or all chauffeurs unavailable for chauffeur service on ${specificDateInput.toDateString()}.`,
  );
  // Log details only if needed, or in development/debug environments to prevent excessive logging in production.
  logger.debug(
    { count: fleetOwnersWithNoChauffeursOrAllChauffeursBusy.length },
    "Unavailable fleet owner details",
  );
  return fleetOwnersWithNoChauffeursOrAllChauffeursBusy.map((owner) => owner.id);
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const bookingType = url.searchParams.get("bookingType");
  const pickupTime = url.searchParams.get("pickupTime");
  const flightNumber = url.searchParams.get("flightNumber");

  logger.info({ from, to, bookingType, pickupTime, flightNumber });

  try {
    // Performance logging
    const startTime = Date.now();

    const fleetOwnersToExclude = from
      ? await getFleetOwnersWithNoChauffeursOrAllChauffeursBusy(new Date(from))
      : [];

    const fleetOwnerQueryTime = Date.now() - startTime;
    logger.info("fleet owners query completed", { ms: fleetOwnerQueryTime });

    const carQueryStartTime = Date.now();

    // Always fetch cars by default (no booking overlap filters)
    const cars = await prisma.car.findMany({
      where: {
        AND: [
          {
            ...(fleetOwnersToExclude.length > 0 && {
              ownerId: { notIn: fleetOwnersToExclude },
            }),
            status: {
              in: [Status.AVAILABLE, Status.BOOKED],
            },
            approvalStatus: { in: [CarApprovalStatus.APPROVED] },
            owner: { fleetOwnerStatus: "APPROVED", hasOnboarded: true },
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

    let filteredCars = cars;

    // Only filter by availability if user has provided all search parameters including pickup time
    // Exception: NIGHT bookings can default to "11 PM" if no pickup time is specified
    // Exception: AIRPORT_PICKUP bookings require flightNumber instead of pickupTime
    if (shouldFilterByAvailability(from, to, cars.length, bookingType, pickupTime, flightNumber)) {
      const carIds = cars.map((c) => c.id);

      // Define a superset window that covers DAY/NIGHT/FULL_DAY overlaps across [from..to]
      const fromStart = new Date(`${from}T00:00:00.000Z`);
      const toStart = new Date(`${to}T00:00:00.000Z`);
      const endWindow = new Date(toStart);
      endWindow.setUTCDate(endWindow.getUTCDate() + 1); // include last night spillover
      endWindow.setUTCHours(5, 0, 0, 0); // up to 05:00 of the day after 'to'

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

      // Type assertions are safe here - shouldFilterByAvailability already validated these
      const validFrom = from as string;
      let timeWindow: PickupTimeWindow;

      if (bookingType === AIRPORT_PICKUP_BOOKING_TYPE && flightNumber) {
        timeWindow = await getAirportPickupTimeWindow(flightNumber, validFrom, fromStart);
      } else {
        // For DAY/NIGHT/FULL_DAY bookings: use pickup time
        const effectivePickupTime =
          bookingType === NIGHT_BOOKING_TYPE && !pickupTime ? "11 PM" : (pickupTime as string);
        timeWindow = parsePickupTimeToUTC(effectivePickupTime, validFrom, toStart);
      }

      const { specificFrom, specificTo } = timeWindow;

      logger.info("Availability check with specific times", {
        bookingType,
        pickupTime,
        specificFrom: specificFrom.toISOString(),
        specificTo: specificTo?.toISOString(),
        bookingsCount: bookingsForEngine.length,
        bookings: bookingsForEngine.map((b) => ({
          carId: b.carId,
          start: b.startDate.toISOString(),
          end: b.endDate.toISOString(),
        })),
      });

      const availableCarIdsList = availableCarsForSpecificRequest(
        carsForEngine,
        bookingsForEngine,
        {
          bookingType: bookingType as BookingType,
          from: specificFrom,
          to: specificTo,
        },
      );

      logger.debug("Available cars after filtering", {
        availableCarIdsList,
        filteredOutCount: carsForEngine.length - availableCarIdsList.length,
      });

      const availableCarIdsSet = new Set(availableCarIdsList);
      filteredCars = cars.filter((c) => availableCarIdsSet.has(c.id));
    }

    const carQueryTime = Date.now() - carQueryStartTime;
    const totalTime = Date.now() - startTime;
    logger.info("cars query completed", { ms: carQueryTime });
    logger.info("availability loader total time", { ms: totalTime });

    return data(
      { cars: filteredCars },
      {
        // Enhanced caching headers for better performance
        headers: {
          "Cache-Control": "public, max-age=300, stale-while-revalidate=1800", // Increased cache time
          Vary: "Accept-Encoding",
          "X-Total-Time": `${totalTime}ms`,
        },
      },
    );
  } catch (error) {
    logger.error("Error in loader:", error instanceof Error ? error.message : "Unknown error");
    // Return empty cars array instead of error object to maintain expected interface

    return data({ cars: [] }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

type LoaderData = {
  cars: SerializedCar[];
};

export default function IndexPage() {
  const { cars } = useLoaderData<LoaderData>();
  const [searchParams] = useSearchParams();
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  // Use string literals instead of Prisma enum to avoid client-side hydration issues
  const validBookingTypes = ["DAY", "NIGHT", "FULL_DAY", "AIRPORT_PICKUP"] as const;
  type ClientBookingType = (typeof validBookingTypes)[number];
  const bookingTypeParam = searchParams.get("bookingType");
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

  // Use extracted hook for car categorization (reduces cognitive complexity)
  const categories = useCarCategories(cars, getRateForBookingType);

  const hasSearchParams = from && to;

  // Use the mobile hook for responsive behavior
  const isMobile = useIsMobile();
  const isDesktop = !isMobile;

  // Scroll-based hero collapse behavior
  const heroScrollState = useHeroScroll();
  const { isDesktopCollapsed, isMobileScrolled } = heroScrollState;
  const { desktopHeight, containerClass: heroContainerClass } =
    getHeroHeightClasses(heroScrollState);

  // Mobile search modal state
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  return (
    <div className="w-full">
      {/* Mobile Compact Sticky Search - Shows after scrolling past hero */}
      {isMobileScrolled && (
        <div className="md:hidden fixed top-0 left-0 right-0 z-50 px-4 py-3 bg-white border-b border-gray-200 shadow-md">
          <CompactSearchBar onClick={() => setIsSearchModalOpen(true)} />
        </div>
      )}

      {/* Mobile Search Modal */}
      <SearchModal isOpen={isSearchModalOpen} onClose={() => setIsSearchModalOpen(false)} />

      {/* Hero Section - Fixed on desktop, relative on mobile */}
      <div className={`w-full transition-all duration-300 ease-out ${heroContainerClass}`}>
        {/* Hero Image - fades out when collapsed (desktop only) */}
        <div
          className={`absolute inset-0 transition-opacity duration-300 ${
            isDesktopCollapsed ? "opacity-0" : "opacity-100"
          }`}
        >
          <picture>
            <source media="(min-width: 1024px)" srcSet="/images/hero.webp" type="image/webp" />
            <source media="(min-width: 768px)" srcSet="/images/hero-1200.webp" type="image/webp" />
            <source media="(min-width: 1024px)" srcSet="/images/hero.png" type="image/png" />
            <img
              src="/images/hero.png"
              alt="Professional chauffeur service - luxury vehicle ready for hire"
              className="w-full h-full object-cover"
              width="1024"
              height="540"
              decoding="async"
            />
          </picture>
          {/* Dark overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/60" />
        </div>

        {/* Collapsed header background (desktop only) */}
        {isDesktop && (
          <div
            className={`absolute inset-0 bg-white border-b border-gray-200 transition-opacity duration-300 ${
              isDesktopCollapsed ? "opacity-100" : "opacity-0"
            }`}
          />
        )}

        {/* Hero Content */}
        <div
          className={`relative z-10 flex flex-col items-center h-full px-4 max-w-4xl mx-auto transition-all duration-300 ${
            isDesktopCollapsed ? "justify-center py-4" : "justify-center"
          }`}
        >
          {/* Title & description - hide when scrolled (desktop full collapse, mobile text only) */}
          <div
            className={`transition-all duration-300 overflow-hidden ${
              isDesktopCollapsed || isMobileScrolled
                ? "opacity-0 max-h-0 mb-0"
                : "opacity-100 max-h-40 mb-6"
            }`}
          >
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white text-center mb-3">
              Find your perfect ride
            </h1>
            <p className="text-base md:text-lg text-white/90 text-center max-w-2xl leading-relaxed">
              Comfort. Safety. Professional service. Every ride.
            </p>
          </div>

          {/* Search Box - always visible, adapts style on desktop collapse */}
          <div
            className={`w-full transition-all duration-300 ${isDesktopCollapsed ? "max-w-4xl" : "max-w-2xl"}`}
          >
            <BookingSearch isCompact={isDesktopCollapsed} />
          </div>

          {/* Trust Badges - hide when collapsed on desktop */}
          <div
            className={`flex flex-wrap justify-center gap-4 md:gap-6 text-white transition-all duration-300 overflow-hidden ${
              isDesktopCollapsed ? "opacity-0 max-h-0 mt-0" : "opacity-100 max-h-20 mt-6"
            }`}
          >
            <div className="flex items-center gap-2">
              <LocateFixed className="h-4 w-4 md:h-5 md:w-5 text-blue-400" />
              <span className="text-xs md:text-sm">Real-time tracking</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 md:h-5 md:w-5 text-green-400" />
              <span className="text-xs md:text-sm">Vetted chauffeurs</span>
            </div>
            <div className="flex items-center gap-2">
              <Fingerprint className="h-4 w-4 md:h-5 md:w-5 text-orange-400" />
              <span className="text-xs md:text-sm">Secure booking</span>
            </div>
          </div>
        </div>
      </div>

      {/* Spacer for fixed hero - only needed on desktop (mobile is relative) */}
      <div className={`hidden md:block transition-all duration-300 ${desktopHeight}`} />

      {/* Main Content Container - Scrolls underneath fixed hero */}
      <div className="relative z-0 bg-white py-8 md:py-12">
        {cars.length ? (
          <div className="space-y-8">
            {/* Show category carousel sections only when no search is active */}
            {!hasSearchParams && (
              <>
                {/* Filter Pills */}
                <div className="max-w-[1400px] mx-auto px-4 md:px-8">
                  <div className="flex items-center gap-2 md:gap-3 overflow-x-auto scrollbar-hide pb-2">
                    {categories.suvs.length > 0 && (
                      <a
                        href="#suvs"
                        className="flex-shrink-0 px-3 md:px-4 py-1.5 md:py-2 rounded-full border border-gray-300 hover:border-gray-900 hover:bg-gray-50 transition-all text-xs md:text-sm font-medium whitespace-nowrap"
                      >
                        SUV ({categories.suvs.length})
                      </a>
                    )}
                    {categories.luxury.length > 0 && (
                      <a
                        href="#luxury"
                        className="flex-shrink-0 px-3 md:px-4 py-1.5 md:py-2 rounded-full border border-gray-300 hover:border-gray-900 hover:bg-gray-50 transition-all text-xs md:text-sm font-medium whitespace-nowrap"
                      >
                        Luxury ({categories.luxury.length})
                      </a>
                    )}
                    {categories.executive.length > 0 && (
                      <a
                        href="#executive"
                        className="flex-shrink-0 px-3 md:px-4 py-1.5 md:py-2 rounded-full border border-gray-300 hover:border-gray-900 hover:bg-gray-50 transition-all text-xs md:text-sm font-medium whitespace-nowrap"
                      >
                        Executive ({categories.executive.length})
                      </a>
                    )}
                    {categories.budget.length > 0 && (
                      <a
                        href="#budget"
                        className="flex-shrink-0 px-3 md:px-4 py-1.5 md:py-2 rounded-full border border-gray-300 hover:border-gray-900 hover:bg-gray-50 transition-all text-xs md:text-sm font-medium whitespace-nowrap"
                      >
                        Budget-friendly ({categories.budget.length})
                      </a>
                    )}
                    {categories.popular.length > 0 && (
                      <a
                        href="#popular"
                        className="flex-shrink-0 px-3 md:px-4 py-1.5 md:py-2 rounded-full border border-gray-300 hover:border-gray-900 hover:bg-gray-50 transition-all text-xs md:text-sm font-medium whitespace-nowrap"
                      >
                        Popular ({categories.popular.length})
                      </a>
                    )}
                    {categories.sedans.length > 0 && (
                      <a
                        href="#sedans"
                        className="flex-shrink-0 px-3 md:px-4 py-1.5 md:py-2 rounded-full border border-gray-300 hover:border-gray-900 hover:bg-gray-50 transition-all text-xs md:text-sm font-medium whitespace-nowrap"
                      >
                        Sedans ({categories.sedans.length})
                      </a>
                    )}
                  </div>
                </div>

                {/* SUVs Section */}
                {categories.suvs.length > 0 && (
                  <CarouselSection title="SUV" id="suvs" href="#suvs">
                    {categories.suvs.map((car, index) => (
                      <CarCard
                        key={car.id}
                        car={car}
                        searchParams={searchParams}
                        priority={index < 5}
                        price={getRateForBookingType(car)}
                        showTotal={false}
                      />
                    ))}
                  </CarouselSection>
                )}

                {/* Luxury Section */}
                {categories.luxury.length > 0 && (
                  <CarouselSection title="Luxury" id="luxury" href="#luxury">
                    {categories.luxury.map((car) => (
                      <CarCard
                        key={car.id}
                        car={car}
                        searchParams={searchParams}
                        priority={false}
                        price={getRateForBookingType(car)}
                        showTotal={false}
                      />
                    ))}
                  </CarouselSection>
                )}

                {/* Executive Section */}
                {categories.executive.length > 0 && (
                  <CarouselSection title="Executive" id="executive" href="#executive">
                    {categories.executive.map((car) => (
                      <CarCard
                        key={car.id}
                        car={car}
                        searchParams={searchParams}
                        priority={false}
                        price={getRateForBookingType(car)}
                        showTotal={false}
                      />
                    ))}
                  </CarouselSection>
                )}

                {/* Budget-Friendly Section */}
                {categories.budget.length > 0 && (
                  <CarouselSection title="Budget-friendly" id="budget" href="#budget">
                    {categories.budget.map((car) => (
                      <CarCard
                        key={car.id}
                        car={car}
                        searchParams={searchParams}
                        priority={false}
                        price={getRateForBookingType(car)}
                        showTotal={false}
                      />
                    ))}
                  </CarouselSection>
                )}

                {/* Popular Section */}
                {categories.popular.length > 0 && (
                  <CarouselSection title="Popular" id="popular" href="#popular">
                    {categories.popular.map((car) => (
                      <CarCard
                        key={car.id}
                        car={car}
                        searchParams={searchParams}
                        priority={false}
                        price={getRateForBookingType(car)}
                        showTotal={false}
                      />
                    ))}
                  </CarouselSection>
                )}

                {/* Sedans Section */}
                {categories.sedans.length > 0 && (
                  <CarouselSection title="Sedans" id="sedans" href="#sedans">
                    {categories.sedans.map((car) => (
                      <CarCard
                        key={car.id}
                        car={car}
                        searchParams={searchParams}
                        priority={false}
                        price={getRateForBookingType(car)}
                        showTotal={false}
                      />
                    ))}
                  </CarouselSection>
                )}
              </>
            )}

            {/* All Vehicles Section - Grid for search results, Carousel for browsing */}
            {hasSearchParams ? (
              <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
                <section>
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h2 className="text-2xl md:text-3xl font-semibold">
                        Available for your dates
                      </h2>
                      <p className="text-gray-600 mt-1">
                        {categories.allCars.length}{" "}
                        {categories.allCars.length === 1 ? "vehicle" : "vehicles"} available
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {categories.allCars.map((car, index) => (
                      <CarCard
                        key={car.id}
                        car={car}
                        searchParams={searchParams}
                        priority={index < 3}
                        price={getRateForBookingType(car)}
                        showTotal={true}
                        totalPrice={getRateForBookingType(car) * totalUnits}
                        variant="grid"
                      />
                    ))}
                  </div>
                </section>
              </div>
            ) : (
              <CarouselSection title="All vehicles" href="#">
                {categories.allCars.map((car, index) => (
                  <CarCard
                    key={car.id}
                    car={car}
                    searchParams={searchParams}
                    priority={index < 5}
                    price={getRateForBookingType(car)}
                    showTotal={false}
                  />
                ))}
              </CarouselSection>
            )}
          </div>
        ) : (
          <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
            <div className="text-center py-16">
              <p className="text-xl text-gray-600 mb-4">No cars available for your search</p>
              <p className="text-gray-500 mb-6">Try adjusting your dates or booking type</p>
              <Link
                to="/"
                className="inline-block px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
              >
                Browse all vehicles
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
