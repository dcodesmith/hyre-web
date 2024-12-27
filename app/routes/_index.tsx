// "use client";

// import invariant from "tiny-invariant";
import { BookingStatus } from "@prisma/client";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useLoaderData, useSearchParams } from "@remix-run/react";
import {
  ColumnFilter,
  ColumnFiltersState,
  ColumnSort,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  InitialTableState,
  PaginationState,
  SortingState,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table";
import { useState } from "react";
// import util from "util";
import Carousel from "~/components/Carousel";
import { columns } from "~/components/Table/Columns";
import { Pagination } from "~/components/Table/Pagination";
import { Toolbar } from "~/components/Table/Toolbar";
import { prisma } from "~/modules/db/db.server";

import type { SerializedCar } from "~/types";

const blockingStatuses: BookingStatus[] = ["PENDING", "CONFIRMED", "ACTIVE"];

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

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

  const cars = await prisma.car.findMany({
    where: {
      ownerId: {
        notIn: ownerIdsToExclude,
      },
      // make: {
      //   mode: "insensitive",
      //   in: makes.length > 0 ? makes : undefined,
      // },
      OR: [
        {
          status: "AVAILABLE",
        },
        {
          status: "BOOKED",
          bookings: {
            none: {
              status: { in: ["PENDING", "CONFIRMED", "ACTIVE"] },
              OR: [
                {
                  startDate: {
                    lte: to ? new Date(`${to}T23:59:59Z`) : undefined,
                  },
                  endDate: {
                    gte: from ? new Date(`${from}T00:00:00Z`) : undefined,
                  },
                },
              ],
            },
          },
        },
      ],
    },
    include: {
      owner: { select: { username: true } },
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
    tableState.columnFilters.forEach((filter) => {
      params.set(`filter.${filter.id}`, filter.value as string);
    });
  }

  // Persist sorting
  if (tableState.sorting && tableState.sorting.length > 0) {
    tableState.sorting.forEach((sort) => {
      params.set(`sort.${sort.id}`, sort.desc ? "desc" : "asc");
    });
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

  // Initialize table state from URL search params
  const initialTableState = parseSearchParamsToTableState(searchParams);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(
    initialTableState.columnFilters
  );
  const [sorting, setSorting] = useState<SortingState>(
    initialTableState.sorting
  );

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
      const newSorting =
        typeof updater === "function" ? updater(sorting) : updater;

      setSorting(newSorting);

      // Update URL search params when sorting changes
      const params = convertTableStateToSearchParams({
        columnFilters,
        sorting: newSorting,
      });

      setSearchParams(params);
    },
    onColumnFiltersChange: (updater) => {
      const newFilters =
        typeof updater === "function" ? updater(columnFilters) : updater;

      setColumnFilters(newFilters);

      const params = convertTableStateToSearchParams({
        columnFilters: newFilters,
        sorting,
      });

      //setSearchParams(params);

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
    if (
      new Date(from).toLocaleDateString() === new Date(to).toLocaleDateString()
    ) {
      return 1;
    }

    // Add 1 to include both the start and end dates
    const days =
      Math.ceil(
        (new Date(to).getTime() - new Date(from).getTime()) / (1000 * 3600 * 24)
      ) + 1;

    return days;
  };

  return (
    <div className="max-w-8xl mx-auto space-y-4">
      <Toolbar table={table} />

      {table.getRowModel().rows.length ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-8">
          {table.getRowModel().rows.map((row) => (
            <Link
              // className="relative"
              key={row.original.id}
              to={`/cars/${row.original.id}?${searchParams.toString()}`}
            >
              <div className="rounded overflow-hidden hover:shadow-lg transition-shadow">
                <Carousel
                  images={
                    row.original.images.length ? row.original.images : undefined
                  }
                />

                <div className="p-4 space-y-1">
                  <h2 className="font-semibold">
                    {row.original.make} {row.original.model} (
                    {row.original.year})
                  </h2>

                  <p>
                    {!from || !to ? (
                      <>
                        {new Intl.NumberFormat("en-NG", {
                          style: "currency",
                          currency: "NGN",
                        }).format(row.original.price)}
                      </>
                    ) : (
                      <>
                        Booking total:{" "}
                        <span className="font-bold underline">
                          {new Intl.NumberFormat("en-NG", {
                            style: "currency",
                            currency: "NGN",
                          }).format(row.original.price * calculateTotalDays())}
                        </span>
                      </>
                    )}
                  </p>
                  {process.env.NODE_ENV === "development" && (
                    <span className="text-sm text-gray-500">
                      {row.original.owner.username}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div>No cars matching your search criteria.</div>
      )}

      {table.getFilteredRowModel().rows.length > PAGE_SIZE && (
        <Pagination
          range={[PAGE_SIZE, PAGE_SIZE * 2, PAGE_SIZE * 3]}
          table={table}
        />
      )}
    </div>
  );
}
