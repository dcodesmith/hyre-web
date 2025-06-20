// "use client";

// import invariant from "tiny-invariant";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, redirect, useLoaderData, useSearchParams } from "@remix-run/react";
import {
  ColumnFiltersState,
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
import { useState } from "react";
// import util from "util";
import Carousel from "~/components/Carousel";
import { columns } from "~/components/Table/Columns";
import { Pagination } from "~/components/Table/Pagination";
import { Toolbar } from "~/components/Table/Toolbar";
import { URLFacetedFilter } from "~/components/Table/URLFacetedFilter";
import { requireSessionUser, requireUser } from "~/modules/auth/auth.server";
import { prisma } from "~/modules/db/db.server";

import type { SerializedCar } from "~/types";
import { userHasRole } from "~/utils/misc";

export async function loader({ request }: LoaderFunctionArgs) {
  // const user = await requireUser(request);

  // if (userHasRole(user, "fleetOwner")) {
  //   return redirect("/fleet-owner");
  // }

  // await requireUser(request, { redirectTo: "/fleet-owner" });
  // await requireSessionUser(request, { redirectTo: "/fleet-owner" });

  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const makes = url.searchParams.getAll("make");
  const models = url.searchParams.getAll("model");
  const cars = await prisma.car.findMany({
    where: {
      make: {
        mode: "insensitive",
        in: makes.length > 0 ? makes.toString().split(",") : undefined,
      },
      model: {
        mode: "insensitive",
        in: models.length > 0 ? models.toString().split(",") : undefined,
      },
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

  const allMakes = await prisma.car
    .findMany({
      where: {
        model: {
          in: models.length > 0 ? models.toString().split(",") : undefined,
        },
      },
      distinct: ["make"],
      select: { make: true },
    })
    .then((makes) => makes.map((m) => m.make));

  const allModels = await prisma.car
    .findMany({
      where: {
        make: {
          in: makes.length > 0 ? makes.toString().split(",") : undefined,
        },
      },
      distinct: ["model"],
      select: { model: true },
    })
    .then((models) => models.map((m) => m.model));

  return json({
    cars,
    makes: allMakes,
    models: allModels,
  });
}

// const PAGE_SIZE = 12;

export default function IndexPage() {
  const { cars } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  // const [sorting, setSorting] = useState<SortingState>([]);
  // const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  // // const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  // const [pagination, setPagination] = useState<PaginationState>({
  //   pageIndex: 0,
  //   pageSize: PAGE_SIZE,
  // });
  // const table = useReactTable<SerializedCar>({
  //   data: cars,
  //   columns,
  //   state: {
  //     sorting,
  //     columnVisibility,
  //     // columnFilters,
  //     pagination,
  //   },
  //   getCoreRowModel: getCoreRowModel(),
  //   getPaginationRowModel: getPaginationRowModel(),
  //   getSortedRowModel: getSortedRowModel(),
  //   getFacetedUniqueValues: getFacetedUniqueValues(),
  //   getFacetedRowModel: getFacetedRowModel(),
  //   getFilteredRowModel: getFilteredRowModel(),

  //   onSortingChange: setSorting,
  //   // onColumnFiltersChange: setColumnFilters,
  //   onColumnVisibilityChange: setColumnVisibility,
  //   onPaginationChange: setPagination,
  // });

  // const makes = [...new Set(table.options.data.map(({ make }) => make))];
  // const models = [...new Set(table.options.data.map(({ model }) => model))];

  return (
    <div className="max-w-8xl mx-auto space-y-4">
      {/* <Toolbar table={table} /> */}

      {/* <URLFacetedFilter
        title="Make"
        paramKey="make"
        options={makes.map((make) => ({
          label: make,
          value: make,
        }))}
      />

      <URLFacetedFilter
        title="Model"
        paramKey="model"
        options={models.map((model) => ({
          label: model,
          value: model,
        }))}
      /> */}

      {cars.length ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-8">
          {cars.map((car) => (
            <Link key={car.id} to={`/cars/${car.id}?${searchParams.toString()}`} className="block">
              <div className="rounded overflow-hidden hover:shadow-lg transition-shadow">
                <Carousel images={car.images.map((image) => image.url)} />

                <div className="p-4">
                  <h2 className="font-semibold mb-2">
                    {car.make} {car.model} ({car.year})
                  </h2>

                  <p className="font-bold">
                    {new Intl.NumberFormat("en-NG", {
                      style: "currency",
                      currency: "NGN",
                    }).format(car.dayRate)}
                  </p>
                  {/* {car.owner.username} */}
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div>No cars matching your search criteria.</div>
      )}

      {/* {table.getFilteredRowModel().rows.length > PAGE_SIZE && (
        <Pagination
          range={[PAGE_SIZE, PAGE_SIZE * 2, PAGE_SIZE * 3]}
          table={table}
        />
      )} */}
    </div>
  );
}
