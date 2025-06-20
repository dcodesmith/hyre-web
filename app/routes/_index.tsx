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
import { LocateFixed, ShieldCheck, Star } from "lucide-react";
import { useRef, useState } from "react";
import Carousel from "~/components/Carousel";
import { columns } from "~/components/Table/Columns";
import { Pagination } from "~/components/Table/Pagination";
import { Toolbar } from "~/components/Table/Toolbar";
import { Button } from "~/components/ui/button";
import { prisma } from "~/modules/db/db.server";

import type { SerializedCar } from "~/types";

const blockingStatuses: BookingStatus[] = ["PENDING", "CONFIRMED", "ACTIVE"];

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  async function getFleetOwnersWithAllChauffeursBusy(specificDateInput?: Date) {
    if (!specificDateInput) {
      return [];
    }

    // Use UTC methods to get the year, month, and day from the input Date object.
    // This ensures that we correctly define the day in UTC, regardless of the
    // local timezone of the server or the time component of the input Date.
    const year = specificDateInput.getUTCFullYear();
    const month = specificDateInput.getUTCMonth(); // JavaScript months are 0-indexed (0 for January, 11 for December)
    const day = specificDateInput.getUTCDate();

    // Create Date objects for the very start and very end of that day in UTC.
    const startDateAtTargetDate = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
    const endDateAtTargetDate = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));

    const busyFleetOwners = await prisma.user.findMany({
      where: {
        // Condition 1: The user must be a fleet owner, meaning they have at least one chauffeur.
        chauffeurs: {
          some: {}, // Ensures this user has at least one chauffeur.
        },
        // Condition 2: ALL of this fleet owner's chauffeurs must be busy on the specificDate.
        AND: [
          {
            chauffeurs: {
              every: {
                // A chauffeur is considered busy if they have at least one booking meeting the criteria.
                bookingsAsChauffeur: {
                  some: {
                    status: {
                      in: [BookingStatus.CONFIRMED, BookingStatus.ACTIVE],
                    },
                    // Check for overlap with the specific date (entire day in UTC)
                    AND: [
                      // {
                      //   startDate: {
                      //     lte: endDateAtTargetDate, // Booking starts on or before the end of the target day (UTC)
                      //   },
                      // },
                      {
                        endDate: {
                          gte: startDateAtTargetDate, // Booking ends on or after the start of the target day (UTC)
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
        id: true, // We only need the IDs of the fleet owners
      },
    });

    return busyFleetOwners.map((owner) => owner.id);
  }

  const ownersWithAllChauffeursBusy = await prisma.user.findMany({
    where: {
      AND: [
        // Ensure the user (fleet owner) *has* chauffeurs
        {
          chauffeurs: {
            some: {},
          },
        },
        // For each chauffeur, check if there's *some* booking that overlaps
        // the requested date range (startDate < booking.endDate && endDate > booking.startDate).
        {
          chauffeurs: {
            every: {
              bookingsAsChauffeur: {
                some: {
                  car: {
                    owner: {
                      is: {},
                    },
                  },
                  status: {
                    in: blockingStatuses,
                  },
                  // Overlap condition
                  // startDate: {
                  //   lt: endDate,
                  // },
                  endDate: {
                    gte: from ? new Date(from) : undefined,
                  },
                  // Optionally, filter by booking status if you only consider
                  // certain statuses as blocking. E.g.:
                  // status: { in: ['CONFIRMED', 'ACTIVE'] },
                },
              },
            },
          },
        },
      ],
    },
    select: {
      id: true, // We only need the IDs of these owners
    },
  });

  // Collect the IDs of these owners
  const ownerIdsToExclude = ownersWithAllChauffeursBusy.map((o) => o.id);
  const idsToExclude = await getFleetOwnersWithAllChauffeursBusy(from ? new Date(from) : undefined);

  const cars = await prisma.car.findMany({
    where: {
      AND: [
        {
          // Your existing conditions for owner, approvalStatus, etc. should remain
          ownerId: {
            notIn: idsToExclude, // Assuming idsToExclude is defined
          },
          approvalStatus: "APPROVED",
          owner: {
            fleetOwnerStatus: "APPROVED",
            hasOnboarded: true,
          },
        },
        {
          // New condition to exclude cars with conflicting bookings
          NOT: {
            bookings: {
              some: {
                status: { in: ["CONFIRMED", "ACTIVE"] }, // Booked and paid for
                // Overlap condition:
                // A booking conflicts if:
                // its start is before the search range's end AND its end is after the search range's start
                AND: [
                  {
                    startDate: {
                      lt: to ? new Date(`${to}T23:59:59.999Z`) : undefined, // Booking starts before the end of the search 'to' date
                    },
                  },
                  {
                    endDate: {
                      gt: from ? new Date(`${from}T00:00:00.000Z`) : undefined, // Booking ends after the start of the search 'from' date
                    },
                  },
                ],
              },
            },
          },
        },
      ],
    },
    include: {
      owner: { select: { username: true } },
      images: { select: { url: true } },
    },
  });

  return json({ cars });
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

  const baseUrl = process.env.NODE_ENV === "production" ? "https://hyre-neon.vercel.app/" : "";

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
                <span>Vetted chauffeurs</span>
              </div>
              <div className="flex items-center gap-2">
                <LocateFixed className="h-4 w-4" />
                <span>Real-time location tracking</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                <span>Secure online booking</span>
              </div>
            </div>
          </div>
        </div>

        <div className="relative lg:col-span-2 md:col-span-1 hidden md:block">
          <img
            src={`${baseUrl}/images/hero.png`}
            alt="Hero"
            className="md:h-[648px] w-full object-cover"
          />
        </div>
      </div>

      {table.getRowModel().rows.length ? (
        <div
          ref={carsRef}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-2 gap-y-6"
        >
          {table.getRowModel().rows.map((row) => (
            <Link key={row.original.id} to={`/cars/${row.original.id}?${searchParams.toString()}`}>
              <div className="overflow-hidden space-y-2">
                <Carousel
                  images={
                    row.original.images.length
                      ? row.original.images.map(({ url }) => url)
                      : undefined
                  }
                />

                <div className="space-y-1 font-semibold flex flex-col">
                  <div className="flex justify-between">
                    <h2 className="text-base">
                      {row.original.make} {row.original.model} ({row.original.year})
                    </h2>
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />

                      <span className="font-medium">
                        {(4.0 + (Number.parseInt(row.original.id.slice(-2), 16) % 10) / 10).toFixed(
                          1,
                        )}
                      </span>
                      <span>
                        ({50 + (Number.parseInt(row.original.id.slice(-3), 16) % 950)} reviews)
                      </span>
                    </div>
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
