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
import { Fingerprint, LocateFixed, ShieldCheck, Star } from "lucide-react";
import { AvailabilityHint } from "~/components/AvailabilityHint";
import Carousel from "~/components/Carousel";
import { BookingSearch } from "~/components/BookingSearch";

import logger from "~/lib/logger.server";
import { prisma } from "~/modules/db/db.server";
import { availabilityByType } from "~/services/availability-engine.server";

import type { SerializedCar } from "~/types";
import { useCallback, useMemo } from "react";

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
  const fleetOwnersWithNoChauffeursOrAllChauffeursBusy = await prisma.user.findMany({
    where: {
      // Condition: The user must be a fleet owner (i.e., owns at least one car)
      cars: {
        some: {},
      },
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

  logger.info({ from, to, bookingType, pickupTime });

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

    // Build availability per carId for booking types (DAY, NIGHT, FULL_DAY)
    const availabilityByCarId: Record<
      string,
      {
        available: Array<BookingType>;
        unavailable: Array<BookingType>;
      }
    > = {};

    let filteredCars = cars;

    if (from && to && cars.length > 0) {
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
          status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.ACTIVE] },
          AND: [{ startDate: { lt: endWindow } }, { endDate: { gt: fromStart } }],
        },
        select: { carId: true, type: true, startDate: true, endDate: true, status: true },
      });

      const carsForEngine = cars.map((c) => ({ id: c.id })) as unknown as Car[];
      const bookingsForEngine = bookings as unknown as Booking[];
      const byType = availabilityByType(carsForEngine, bookingsForEngine, {
        from: fromStart,
        to: toStart,
      });

      for (const entry of byType) {
        const flags = entry.available;
        const ALL: Array<BookingType> = [BookingType.DAY, BookingType.NIGHT, BookingType.FULL_DAY];
        const available = ALL.filter((t) => flags[t]);
        availabilityByCarId[entry.carId] = {
          available,
          unavailable: ALL.filter((t) => !flags[t]),
        };
      }

      // Filter cars down to only those with at least one available type
      const availableCarIds = new Set(
        Object.entries(availabilityByCarId)
          .filter(([, v]) => v.available.length > 0)
          .map(([k]) => k),
      );
      // Build filtered list (do not reassign const)
      filteredCars = cars.filter((c) => availableCarIds.has(c.id));
    }

    const carQueryTime = Date.now() - carQueryStartTime;
    const totalTime = Date.now() - startTime;
    logger.info("cars query completed", { ms: carQueryTime });
    logger.info("availability loader total time", { ms: totalTime });

    return data(
      { cars: filteredCars, availabilityByCarId },
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

    return data(
      { cars: [], availabilityByCarId: {} },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

type LoaderData = {
  cars: SerializedCar[];
  availabilityByCarId: Record<
    string,
    {
      available: Array<"DAY" | "NIGHT" | "FULL_DAY">;
      unavailable: Array<"DAY" | "NIGHT" | "FULL_DAY">;
    }
  >;
};

export default function IndexPage() {
  const { cars, availabilityByCarId } = useLoaderData<LoaderData>();
  const [searchParams] = useSearchParams();
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const validBookingTypes = [BookingType.DAY, BookingType.NIGHT, BookingType.FULL_DAY];
  const bookingTypeParam = searchParams.get("bookingType");
  const isValidBookingType = (value: string | null): value is BookingType =>
    !!value && validBookingTypes.includes(value as BookingType);
  const bookingType = isValidBookingType(bookingTypeParam) ? bookingTypeParam : BookingType.DAY;

  const getRateForBookingType = useCallback(
    (car: SerializedCar) => {
      switch (bookingType) {
        case BookingType.NIGHT:
          return car.nightRate;
        case BookingType.FULL_DAY:
          return car.fullDayRate;
        default:
          return car.dayRate;
      }
    },
    [bookingType],
  );

  const totalDays = useMemo(() => {
    if (!from || !to) {
      return 1;
    }

    // If both dates are the same day, return 1
    if (new Date(from).toLocaleDateString() === new Date(to).toLocaleDateString()) {
      return 1;
    }

    // Add 1 to include both the start and end dates
    const days =
      Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / (1000 * 3600 * 24)) + 1;

    return days;
  }, [from, to]);

  return (
    <div className="max-w-8xl mx-auto space-y-2 -mt-16">
      <div className="grid grid-cols-1 lg:grid-cols-3 md:grid-cols-2 gap-2">
        <div className="flex flex-col col-span-1">
          <div className="mx-auto gap-2 flex py-12 md:py-20 flex-col md:mt-4 mt-12">
            <div className="w-64 text-3xl font-semibold">
              Comfort. Safety. Professional. Every Ride.
            </div>

            <BookingSearch />

            <div className="flex flex-col mt-4 gap-2">
              <div className="flex items-center gap-2">
                <LocateFixed className="h-4 w-4 text-blue-600" />
                <span>Real-time Location Tracking</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-orange-500" />
                <span>Vetted Chauffeurs</span>
              </div>
              <div className="flex items-center gap-2">
                <Fingerprint className="h-4 w-4 text-green-600" />
                <span>Secure Online Booking</span>
              </div>
            </div>
          </div>
        </div>

        <div className="relative lg:col-span-2 md:col-span-1 hidden md:block">
          <picture>
            <source media="(min-width: 1024px)" srcSet="/images/hero.webp" type="image/webp" />
            <source media="(min-width: 768px)" srcSet="/images/hero-1200.webp" type="image/webp" />
            <source media="(min-width: 1024px)" srcSet="/images/hero.png" type="image/png" />
            <img
              src="/images/hero.png"
              alt="Professional chauffeur service - luxury vehicle ready for hire"
              className="md:h-[648px] w-full object-cover"
              width="1024"
              height="1024"
              decoding="async"
            />
          </picture>
        </div>
      </div>

      {cars.length ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-2 gap-y-6">
          {cars.map((car, index) => (
            <Link key={car.id} to={`/cars/${car.id}?${searchParams.toString()}`}>
              <div className="overflow-hidden space-y-2">
                <Carousel
                  images={car.images.length ? car.images.map(({ url }) => url) : undefined}
                  priority={index < 3} // Only first 3 cars are above-the-fold
                />

                <div className="space-y-1 font-semibold flex flex-col">
                  <div className="flex justify-between items-center">
                    <h3 className="text-base">
                      {car.make} {car.model} ({car.year})
                    </h3>
                    {from && to && (
                      <AvailabilityHint
                        totalDays={totalDays}
                        status={availabilityByCarId?.[car.id]}
                      />
                    )}
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-gray-400" />
                    </div>
                  </div>

                  <div>
                    {!from || !to ? (
                      <span className="font-bold text-base">
                        {new Intl.NumberFormat("en-NG", {
                          style: "currency",
                          currency: "NGN",
                        }).format(getRateForBookingType(car))}
                      </span>
                    ) : (
                      <>
                        Booking total:{" "}
                        <span className="font-bold underline">
                          {new Intl.NumberFormat("en-NG", {
                            style: "currency",
                            currency: "NGN",
                          }).format(getRateForBookingType(car) * totalDays)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div>No cars matching your search criteria.</div>
      )}
    </div>
  );
}
