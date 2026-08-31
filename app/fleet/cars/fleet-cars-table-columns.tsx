import type { Column, ColumnDef, FilterFn } from "@tanstack/react-table";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckCircle2Icon,
  ChevronsUpDownIcon,
  EllipsisIcon,
  EyeIcon,
  PencilIcon,
  XCircleIcon,
} from "lucide-react";
import { Link } from "react-router";

import type { FleetCar } from "~/api/fleet/cars/schema";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { formatCurrency } from "~/money/currency";
import { FleetCarStatusBadge } from "./fleet-car-status-badge";
import type { FleetCarsTableFeatures } from "./fleet-cars-table-features";

export const fleetCarArrayFilter: FilterFn<FleetCarsTableFeatures, FleetCar> = (
  row,
  columnId,
  value: string[],
) => value.includes(String(row.getValue(columnId)));

type SortableHeaderProps = {
  readonly column: Column<FleetCarsTableFeatures, FleetCar>;
  readonly title: string;
};

function SortableHeader({ column, title }: SortableHeaderProps) {
  const sortDirection = column.getIsSorted();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 rounded-md px-2 data-[state=open]:bg-accent"
        >
          {title}
          {sortDirection === "asc" ? (
            <ArrowUpIcon aria-hidden="true" className="ml-2 size-4" />
          ) : null}
          {sortDirection === "desc" ? (
            <ArrowDownIcon aria-hidden="true" className="ml-2 size-4" />
          ) : null}
          {!sortDirection ? (
            <ChevronsUpDownIcon aria-hidden="true" className="ml-2 size-4" />
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onSelect={() => column.toggleSorting(false)}>
          <ArrowUpIcon aria-hidden="true" />
          Asc
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => column.toggleSorting(true)}>
          <ArrowDownIcon aria-hidden="true" />
          Desc
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => column.clearSorting()}>
          <XCircleIcon aria-hidden="true" />
          Clear
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function header(title: string) {
  return ({ column }: { column: Column<FleetCarsTableFeatures, FleetCar> }) => (
    <SortableHeader column={column} title={title} />
  );
}

export const fleetCarsColumns: ColumnDef<FleetCarsTableFeatures, FleetCar>[] = [
  {
    accessorKey: "registrationNumber",
    header: header("Registration"),
    enableHiding: false,
    cell: ({ row }) => (
      <div className="flex min-w-36 items-center gap-2 font-medium">
        <span>{row.original.registrationNumber}</span>
        {row.original.approvalStatus === "APPROVED" ? (
          <>
            <CheckCircle2Icon aria-hidden="true" className="size-4 shrink-0 text-green-500" />
            <span className="sr-only">Approved</span>
          </>
        ) : null}
      </div>
    ),
  },
  {
    accessorKey: "make",
    header: header("Make"),
    filterFn: fleetCarArrayFilter,
  },
  {
    accessorKey: "model",
    header: header("Model"),
    filterFn: fleetCarArrayFilter,
  },
  {
    accessorKey: "year",
    header: header("Year"),
  },
  {
    accessorKey: "dayRate",
    header: header("Day rate"),
    cell: ({ row }) => formatCurrency(row.original.dayRate),
  },
  {
    accessorKey: "hourlyRate",
    header: header("Hourly rate"),
    cell: ({ row }) => formatCurrency(row.original.hourlyRate),
  },
  {
    accessorKey: "nightRate",
    header: header("Night rate"),
    cell: ({ row }) => formatCurrency(row.original.nightRate),
  },
  {
    accessorKey: "fullDayRate",
    header: header("Full day rate"),
    cell: ({ row }) => formatCurrency(row.original.fullDayRate),
  },
  {
    accessorKey: "fuelUpgradeRate",
    header: header("Fuel upgrade"),
    cell: ({ row }) =>
      row.original.fuelUpgradeRate == null ? "—" : formatCurrency(row.original.fuelUpgradeRate),
  },
  {
    accessorKey: "status",
    header: header("Status"),
    filterFn: fleetCarArrayFilter,
    cell: ({ row }) => (
      <div className="flex min-h-8 items-center">
        <FleetCarStatusBadge status={row.original.status} />
      </div>
    ),
  },
  {
    id: "actions",
    enableHiding: false,
    enableSorting: false,
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={`Open actions for ${row.original.make} ${row.original.model}, ${row.original.registrationNumber}`}
          >
            <EllipsisIcon aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link to={`/fleet-owner/cars/${row.original.id}`}>
              <EyeIcon aria-hidden="true" />
              View details
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to={`/fleet-owner/cars/${row.original.id}/edit`}>
              <PencilIcon aria-hidden="true" />
              Edit
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
];
