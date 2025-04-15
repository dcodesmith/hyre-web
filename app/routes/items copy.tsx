// "use client";

// import invariant from "tiny-invariant";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useLoaderData, useLocation, useNavigate, useSearchParams } from "@remix-run/react";
import {
  ColumnFiltersState,
  PaginationState,
  SortingState,
  Table,
  VisibilityState,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useState } from "react";
// import util from "util";
import Carousel from "~/components/Carousel";
import { columns } from "~/components/Table/Columns";
import { Pagination } from "~/components/Table/Pagination";
import { Toolbar } from "~/components/Table/Toolbar";
import { prisma } from "~/modules/db/db.server";

import type { SerializedCar } from "~/types";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const makes = url.searchParams.getAll("make");
  const cars = await prisma.car.findMany({
    where: {
      // make: {
      //   mode: "insensitive",
      //   in: makes.length > 0 ? makes : undefined,
      // },
      OR: [
        // Available cars with no bookings
        {
          status: "AVAILABLE",
        },
        // Booked cars but not booked for the requested dates
        {
          status: "BOOKED",
          bookings: {
            none: {
              status: { in: ["PENDING", "CONFIRMED", "ACTIVE"] },
              OR: [
                {
                  startDate: { lte: to ? new Date(to) : undefined },
                  endDate: { gte: from ? new Date(from) : undefined },
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

export default function IndexPage() {
  const { cars } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

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

    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
  });

  return (
    <div className="max-w-8xl mx-auto space-y-4">
      <Toolbar table={table} />

      {table.getRowModel().rows.length ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-8">
          {table.getRowModel().rows.map((row) => (
            <Link
              key={row.original.id}
              to={`/cars/${row.original.id}?${searchParams.toString()}`}
              className="block"
            >
              <div className="rounded overflow-hidden hover:shadow-lg transition-shadow">
                <Carousel
                  images={row.original.imagesUrl.length ? row.original.imagesUrl : undefined}
                />

                <div className="p-4">
                  <h2 className="font-semibold mb-2">
                    {row.original.make} {row.original.model} ({row.original.year})
                  </h2>

                  <p className="font-bold">
                    {new Intl.NumberFormat("en-NG", {
                      style: "currency",
                      currency: "NGN",
                    }).format(row.original.price)}
                  </p>
                  {/* {row.original.owner.username} */}
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
