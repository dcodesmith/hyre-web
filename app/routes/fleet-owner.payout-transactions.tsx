import { PayoutTransactionStatus } from "@prisma/client";
import { type LoaderFunctionArgs, data, Link, useLoaderData } from "react-router";
import { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import { ColumnHeader } from "~/components/Table/ColumnHeader";
import { LazyTable } from "~/components/Table/LazyTable";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { cn, formatCurrency, formatDate } from "~/lib/utils";
import { prisma } from "~/modules/db/db.server";
import { requireUserWithRole } from "~/utils/server/permissions.server";

type Transaction = ReturnType<typeof useLoaderData<typeof loader>>["transactions"][number];

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUserWithRole(request, "fleetOwner");
  const transactions = await prisma.payoutTransaction.findMany({
    where: {
      fleetOwnerId: user.id,
    },
    orderBy: {
      initiatedAt: "desc",
    },
    select: {
      id: true,
      bookingId: true,
      amountToPay: true,
      status: true,
      payoutProviderReference: true,
      booking: { select: { startDate: true, endDate: true } },
    },
  });

  return data(
    { transactions },
    { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } },
  );
}

const payoutStatusColors: Record<PayoutTransactionStatus, string> = {
  PENDING_APPROVAL: "bg-yellow-50 ring-yellow-500/10 text-yellow-600",
  PENDING_DISBURSEMENT: "bg-blue-50 ring-blue-500/10 text-blue-600",
  PROCESSING: "bg-indigo-50 ring-indigo-500/10 text-indigo-600",
  PAID_OUT: "bg-green-50 ring-green-500/10 text-green-600",
  FAILED: "bg-red-50 ring-red-500/10 text-red-600",
  REVERSED: "bg-purple-50 ring-purple-500/10 text-purple-600",
};

const payoutStatusOptions: Record<PayoutTransactionStatus, string> = {
  PENDING_APPROVAL: "Pending Approval",
  PENDING_DISBURSEMENT: "Pending Disbursement",
  PROCESSING: "Processing",
  PAID_OUT: "Paid Out",
  FAILED: "Failed",
  REVERSED: "Reversed",
};

const columns: ColumnDef<Transaction>[] = [
  {
    accessorKey: "id",
    header: ({ column }) => <ColumnHeader column={column} title="Transaction Id" />,
    cell: ({ row }) => <div className="w-[150px] truncate">{row.original.id}</div>,
    enableColumnFilter: false,
  },
  {
    accessorKey: "bookingId",
    header: ({ column }) => <ColumnHeader column={column} title="Booking Id" />,
    cell: ({ row }) => <div className="w-[150px] truncate">{row.original.bookingId}</div>,
    enableColumnFilter: false,
  },

  {
    accessorKey: "booking.startDate",
    header: ({ column }) => <ColumnHeader column={column} title="Booking Start Date" />,
    cell: ({ row }) => (
      <div className="w-[185px]">
        {row.original.booking ? formatDate(row.original.booking.startDate) : "N/A"}
      </div>
    ),
  },
  {
    accessorKey: "booking.endDate",
    header: ({ column }) => <ColumnHeader column={column} title="Booking End Date" />,
    cell: ({ row }) => (
      <div className="w-[185px]">
        {row.original.booking ? formatDate(row.original.booking.endDate) : "N/A"}
      </div>
    ),
  },
  {
    accessorKey: "amountToPay",
    header: ({ column }) => <ColumnHeader column={column} title="Amount" />,
    cell: ({ row }) => (
      <div className="w-[100px]">{`${formatCurrency(Number(row.original.amountToPay))}`}</div>
    ),
    enableColumnFilter: false,
  },
  {
    accessorKey: "status",
    header: ({ column }) => <ColumnHeader column={column} title="Status" />,
    cell: ({ row }) => (
      <div className="w-[150px]">
        <Badge
          variant="outline"
          className={cn(
            payoutStatusColors[row.original.status],
            "rounded border-none ring-1 ring-inset",
          )}
        >
          {payoutStatusOptions[row.original.status]}
        </Badge>
      </div>
    ),
  },
  {
    accessorKey: "payoutProviderReference",
    header: ({ column }) => <ColumnHeader column={column} title="Provider Reference" />,
    cell: ({ row }) => (
      <div className="w-[150px] truncate">{row.original.payoutProviderReference || "N/A"}</div>
    ),
  },
  {
    id: "actions",
    header: () => null,
    enableHiding: false,
    cell: ({ row }) => {
      const transaction = row.original;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link to={`/fleet-owner/bookings/${transaction.bookingId}`}>View Booking</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];

export default function PayoutTransactionsPage() {
  const { transactions } = useLoaderData<typeof loader>();

  return (
    <div className="container mx-auto">
      <LazyTable data={transactions} columns={columns} />
    </div>
  );
}
