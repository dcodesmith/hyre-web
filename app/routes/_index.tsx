import { BookingStatus } from "@prisma/client";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useLoaderData, useSearchParams } from "@remix-run/react";
import {
  ColumnFilter,
  ColumnFiltersState,
  ColumnSort,
  InitialTableState,
  PaginationState,
  SortingState,
  VisibilityState,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ShieldCheck } from "lucide-react";
import { useRef, useState } from "react";
import Carousel from "~/components/Carousel";
import { columns } from "~/components/Table/Columns";
import { Pagination } from "~/components/Table/Pagination";
import { Toolbar } from "~/components/Table/Toolbar";
import { Button } from "~/components/ui/button";
import logger from "~/lib/logger.server";
import { prisma } from "~/modules/db/db.server";

import type { SerializedCar } from "~/types";

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
      // Only select essential fields for performance
      email: true,
      name: true,
    },
    distinct: ["id"],
    // Add ordering for consistent results
    orderBy: { id: "asc" },
  });

  logger.info(
    `Found ${fleetOwnersWithNoChauffeursOrAllChauffeursBusy.length} fleet owners with no chauffeurs or all chauffeurs unavailable for chauffeur service on ${specificDateInput.toDateString()}.`,
  );
  // Log details only if needed, or in development/debug environments to prevent excessive logging in production.
  logger.info("Unavailable fleet owner details", fleetOwnersWithNoChauffeursOrAllChauffeursBusy);

  return fleetOwnersWithNoChauffeursOrAllChauffeursBusy.map((owner) => owner.id);
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  try {
    // Performance logging
    const startTime = Date.now();

    const fleetOwnersToExclude = await getFleetOwnersWithNoChauffeursOrAllChauffeursBusy(
      from ? new Date(from) : undefined,
    );

    const fleetOwnerQueryTime = Date.now() - startTime;
    logger.info(`Fleet owners query completed in ${fleetOwnerQueryTime}ms`);

    const carQueryStartTime = Date.now();

    // Optimized query with reduced includes for better performance
    const cars = await prisma.car.findMany({
      where: {
        AND: [
          {
            // Your existing conditions for owner, approvalStatus, etc. should remain
            ...(fleetOwnersToExclude.length > 0 && {
              ownerId: {
                notIn: fleetOwnersToExclude,
              },
            }),
            approvalStatus: "APPROVED",
            owner: {
              fleetOwnerStatus: "APPROVED",
              hasOnboarded: true,
            },
          },
          // Only add booking conflict check if dates are provided
          ...(from && to
            ? [
                {
                  NOT: {
                    bookings: {
                      some: {
                        status: { in: [BookingStatus.CONFIRMED, BookingStatus.ACTIVE] },
                        AND: [
                          {
                            startDate: {
                              lt: new Date(`${to}T23:59:59.999Z`),
                            },
                          },
                          {
                            endDate: {
                              gt: new Date(`${from}T00:00:00.000Z`),
                            },
                          },
                        ],
                      },
                    },
                  },
                },
              ]
            : []),
        ],
      },
      include: {
        // Minimal owner info for better performance
        owner: {
          select: {
            username: true,
            name: true,
          },
        },
        // Reduced image selection for faster loading
        images: {
          select: { url: true },
          orderBy: { createdAt: "asc" },
          take: 4, // Reduced from 8 to 4 for faster loading
        },
        // Keep minimal documents for type compatibility
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
          take: 1, // Only take first document for performance
        },
      },
      // Optimize ordering for better performance
      orderBy: [{ updatedAt: "desc" }, { dayRate: "asc" }],
      // Add reasonable limit to prevent excessive data loading
      take: 100, // Reduced from 200 to 100 for faster initial load
    });

    const carQueryTime = Date.now() - carQueryStartTime;
    const totalTime = Date.now() - startTime;
    logger.info(`Cars query completed in ${carQueryTime}ms`);
    logger.info(`Total loader execution time: ${totalTime}ms`);

    return json(
      {
        cars,
      },
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
    logger.error("Error in loader:", error);
    // Return empty cars array instead of error object to maintain expected interface
    return json({
      cars: [],
    });
  }
}

const PAGE_SIZE = 12;

// Utility to convert table state to search params
const convertTableStateToSearchParams = (tableState: InitialTableState) => {
  const params = new URLSearchParams();
  // Persist column filters
  if (tableState.columnFilters && tableState.columnFilters.length > 0) {
    for (const filter of tableState.columnFilters) {
      params.set(`filter.${filter.id}`, filter.value as string);
    }
  }

  // Persist sorting
  if (tableState.sorting && tableState.sorting.length > 0) {
    for (const sort of tableState.sorting) {
      params.set(`sort.${sort.id}`, sort.desc ? "desc" : "asc");
    }
  }

  return params;
};

// Utility to parse search params back to table state
const parseSearchParamsToTableState = (urlSearchParams: URLSearchParams) => {
  const columnFilters: ColumnFilter[] = [];
  const sorting: ColumnSort[] = [];

  for (const [key, value] of urlSearchParams.entries()) {
    if (key.startsWith("filter.")) {
      const columnId = key.replace("filter.", "");
      columnFilters.push({ id: columnId, value: value.split(",") });
    }

    if (key.startsWith("sort.")) {
      const columnId = key.replace("sort.", "");
      sorting.push({ id: columnId, desc: value === "desc" });
    }
  }

  return { columnFilters, sorting };
};

export default function IndexPage() {
  const { cars } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const carsRef = useRef<HTMLDivElement>(null);
  // Initialize table state from URL search params
  const initialTableState = parseSearchParamsToTableState(searchParams);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(
    initialTableState.columnFilters,
  );
  const [sorting, setSorting] = useState<SortingState>(initialTableState.sorting);

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  });

  const table = useReactTable<SerializedCar>({
    data: cars,
    columns,
    state: {
      sorting,
      columnVisibility,
      columnFilters,
      pagination,
    },
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFacetedRowModel: getFacetedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),

    onSortingChange: (updater) => {
      const newSorting = typeof updater === "function" ? updater(sorting) : updater;

      setSorting(newSorting);

      // Update URL search params when sorting changes
      const params = convertTableStateToSearchParams({
        columnFilters,
        sorting: newSorting,
      });

      setSearchParams(params);
    },
    onColumnFiltersChange: (updater) => {
      const newFilters = typeof updater === "function" ? updater(columnFilters) : updater;

      setColumnFilters(newFilters);

      const params = convertTableStateToSearchParams({
        columnFilters: newFilters,
        sorting,
      });

      setSearchParams((prev) => {
        const existingParams = new URLSearchParams(prev);
        const newParams = new URLSearchParams(params);

        // Merge new params with existing ones
        for (const [key, value] of newParams) {
          existingParams.set(key, value);
        }

        return existingParams;
      });
    },
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
  });

  const calculateTotalDays = () => {
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
  };

  return (
    <div className="max-w-8xl mx-auto space-y-2 -mt-16">
      <div className="grid grid-cols-1 lg:grid-cols-3 md:grid-cols-2 gap-2">
        <div className="flex flex-col col-span-1">
          <div className="mx-auto gap-2 flex py-12 md:py-20 flex-col mt-12">
            <div className="w-64 text-3xl font-semibold">
              Comfort. Safety. Professional. Every Ride.
            </div>
            <Toolbar table={table} />
            <Button
              className="w-64"
              onClick={() => carsRef.current?.scrollIntoView({ behavior: "smooth" })}
            >
              Book now
            </Button>
            <div className="flex flex-col mt-4 gap-2">
              <div className="flex justify-item gap-2">
                <ShieldCheck className="h-4 w-4" />
                <span>Vetted Fleet Owners</span>
              </div>
              <div className="flex justify-item gap-2">
                <ShieldCheck className="h-4 w-4" />
                <span>Vetted chauffeurs</span>
              </div>

              {/* <div className="flex items-center gap-2">
                <LocateFixed className="h-4 w-4" />
                <span>Real-time location tracking</span>
              </div> */}
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                <span>Secure online booking</span>
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

      {table.getRowModel().rows.length ? (
        <div
          ref={carsRef}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-2 gap-y-6"
        >
          {table.getRowModel().rows.map((row, index) => (
            <Link key={row.original.id} to={`/cars/${row.original.id}?${searchParams.toString()}`}>
              <div className="overflow-hidden space-y-2">
                <Carousel
                  images={
                    row.original.images.length
                      ? row.original.images.map(({ url }) => url)
                      : undefined
                  }
                  priority={index < 3} // Only first 3 cars are above-the-fold
                />

                <div className="space-y-1 font-semibold flex flex-col">
                  <div className="flex justify-between">
                    <h2 className="text-base">
                      {row.original.make} {row.original.model} ({row.original.year})
                    </h2>
                    {/* <div className="flex items-center gap-1">
                      <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />

                      <span className="font-medium">
                        {(
                          4.0 +
                          (Number.parseInt(row.original.dayRate.toString().slice(-2), 16) % 10) / 10
                        ).toFixed(1)}
                      </span>
                      <span>
                        (
                        {50 +
                          (Number.parseInt(row.original.dayRate.toString().slice(-3), 16) %
                            950)}{" "}
                        reviews)
                      </span>
                    </div> */}
                  </div>

                  <div>
                    {!from || !to ? (
                      <>
                        {/* Day:{" "} */}
                        <span className="font-bold text-base">
                          {new Intl.NumberFormat("en-NG", {
                            style: "currency",
                            currency: "NGN",
                          }).format(row.original.dayRate)}
                        </span>

                        {/* | Night:{" "}
                        {new Intl.NumberFormat("en-NG", {
                          style: "currency",
                          currency: "NGN",
                        }).format(row.original.nightRate)} */}
                      </>
                    ) : (
                      <>
                        Booking total:{" "}
                        <span className="font-bold underline">
                          {new Intl.NumberFormat("en-NG", {
                            style: "currency",
                            currency: "NGN",
                          }).format(row.original.dayRate * calculateTotalDays())}
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

      {table.getFilteredRowModel().rows.length > PAGE_SIZE && (
        <Pagination range={[PAGE_SIZE, PAGE_SIZE * 2, PAGE_SIZE * 3]} table={table} />
      )}
    </div>
  );
}
