import type { Status } from "@prisma/client";
import { ColumnDef } from "@tanstack/react-table";
import { cn, formatCurrency } from "~/lib/utils";
import type { SerializedCar } from "~/types";
import { Badge } from "../ui/badge";
import { ColumnHeader } from "./ColumnHeader";
import { RowActions } from "./RowActions";

const statusColors: Record<Status, string> = {
  AVAILABLE: "bg-green-600",
  BOOKED: "bg-blue-600",
  HOLD: "bg-yellow-600",
  IN_SERVICE: "bg-red-600",
};

export const columns: ColumnDef<SerializedCar>[] = [
  {
    accessorKey: "make",
    header: ({ column }) => <ColumnHeader column={column} title="Make" />,
    enableColumnFilter: true,
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
    cell: ({ row }) => <div className="w-[150px]">{row.original.make}</div>,
  },
  {
    accessorKey: "model",
    header: ({ column }) => <ColumnHeader column={column} title="Model" />,
    enableColumnFilter: true,
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
    cell: ({ row }) => <div className="w-[150px]">{row.original.model}</div>,
  },
  {
    accessorKey: "year",
    header: ({ column }) => <ColumnHeader column={column} title="Year" />,
    cell: ({ row }) => <div className="w-[150px]">{row.original.year}</div>,
  },
  {
    accessorKey: "dayRate",
    header: ({ column }) => <ColumnHeader column={column} title="Day Rate" />,
    cell: ({ row }) => <div className="w-[150px]">{formatCurrency(row.original.dayRate)}</div>,
  },
  {
    accessorKey: "fullDayRate",
    header: ({ column }) => <ColumnHeader column={column} title="24hr Rate" />,
    cell: ({ row }) => <div className="w-[150px]">{formatCurrency(row.original.fullDayRate)}</div>,
  },
  {
    accessorKey: "status",
    header: ({ column }) => <ColumnHeader column={column} title="Status" />,
    enableColumnFilter: true,
    cell: ({ row }) => {
      return (
        <div className="w-[150px]">
          <Badge
            variant="outline"
            className={cn(statusColors[row.original.status], "rounded border-none")}
          >
            {row.original.status.toLowerCase()}
          </Badge>
        </div>
      );
    },
  },
  {
    id: "actions",
    cell: ({ row }) => <RowActions row={row} />,
    header: () => null,
    enableHiding: false,
  },
];
