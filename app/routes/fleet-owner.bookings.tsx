import { BookingStatus, PaymentStatus } from "@prisma/client";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import { ColumnHeader } from "~/components/Table/ColumnHeader";
import { Table } from "~/components/Table/Table";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { cn, formatDate } from "~/lib/utils";
import { requireUser } from "~/modules/auth/auth.server";
import { prisma } from "~/modules/db/db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const bookings = await prisma.booking.findMany({
    where: {
      car: {
        ownerId: user.id,
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
    include: {
      car: true,
      user: true,
      chauffeur: true,
    },
  });

  const serializedBookings = bookings.map((booking) => ({
    ...booking,
    totalAmount: booking.totalAmount.toNumber(),
    netTotal: booking.netTotal?.toNumber() ?? 0,
    vatAmount: booking.vatAmount?.toNumber(),
    platformCustomerServiceFeeAmount: booking.platformCustomerServiceFeeAmount?.toNumber(),
  }));

  return { bookings: serializedBookings };
}

const bookingStatusColors: Record<BookingStatus, string> = {
  PENDING: "bg-yellow-50 ring-yellow-500/10 text-yellow-600", // Represents waiting or uncertainty
  CONFIRMED: "bg-green-50 ring-green-500/10 text-green-600", // Positive confirmation
  ACTIVE: "bg-blue-50 ring-blue-500/10 text-blue-600", // Indicates ongoing activity
  COMPLETED: "bg-gray-50 ring-gray-500/10 text-gray-600", // Neutral, task is finished
  CANCELLED: "bg-red-50 ring-red-500/10 text-red-600", // Negative outcome
  REJECTED: "bg-red-50 ring-red-500/10 text-red-600", // Stronger negative connotation
};

const paymentStatusColors: Record<PaymentStatus, string> = {
  UNPAID: "bg-yellow-50 ring-yellow-500/10 text-yellow-600", // Represents warning or pending action
  PAID: "bg-green-50 ring-green-500/10 text-green-600", // Positive, indicates successful payment
  REFUNDED: "bg-blue-50 ring-blue-500/10 text-blue-600", // Neutral, represents the refund process
  PARTIALLY_REFUNDED: "bg-indigo-50 ring-indigo-500/10 text-indigo-600", // Slightly nuanced color to indicate partial refund
  REFUND_PROCESSING: "bg-yellow-50 ring-yellow-500/10 text-yellow-600", // Represents warning or pending action
  REFUND_FAILED: "bg-red-50 ring-red-500/10 text-red-600", // Stronger negative connotation
};

const bookingStatusOptions: Record<BookingStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  ACTIVE: "Active",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  REJECTED: "Rejected",
};

const paymentStatusOptions: Record<PaymentStatus, string> = {
  UNPAID: "Unpaid",
  PAID: "Paid",
  REFUNDED: "Refunded",
  PARTIALLY_REFUNDED: "Partially Refunded",
  REFUND_PROCESSING: "Refund Processing",
  REFUND_FAILED: "Refund Failed",
};

type SerializedBooking = Awaited<ReturnType<typeof loader>>["bookings"][number];

const columns: ColumnDef<SerializedBooking>[] = [
  {
    accessorKey: "bookingReference",
    header: ({ column }) => <ColumnHeader column={column} title="Booking Reference" />,
    cell: ({ row }) => <div className="w-[150px]">{row.original.bookingReference}</div>,
  },
  {
    accessorKey: "car",
    accessorFn: ({ car }) => `${car.make} ${car.model}`,
    header: ({ column }) => <ColumnHeader column={column} title="Car" />,
    cell: ({ row }) => (
      <div className="w-[200px] text-wrap">
        {`${row.original.car.make} ${row.original.car.model} (${row.original.car.year})`}
      </div>
    ),
  },
  {
    accessorKey: "customer",
    accessorFn: ({ user }) => `${user?.name || user?.email || user?.username}`,
    header: ({ column }) => <ColumnHeader column={column} title="Customer" />,
    cell: ({ row }) => {
      const { user, guestUser } = row.original;
      return (
        <div className="w-[150px]">
          {user?.name || user?.email || user?.username || guestUser?.email}
        </div>
      );
    },
  },
  {
    accessorKey: "chauffeur",
    accessorFn: ({ chauffeur }) => `${chauffeur?.name}`,
    header: ({ column }) => <ColumnHeader column={column} title="Chauffeur" />,
    cell: ({ row }) => {
      const chauffeur = row.original.chauffeur;
      return <div className="w-[130px] text-wrap">{chauffeur?.name || "Not Assigned"}</div>;
    },
  },
  {
    accessorKey: "startDate",
    enableColumnFilter: false,
    header: ({ column }) => <ColumnHeader column={column} title="Start Date" />,
    cell: ({ row }) => <div className="w-[185px]">{formatDate(row.original.startDate)}</div>,
  },
  {
    accessorKey: "endDate",
    enableColumnFilter: false,
    header: ({ column }) => <ColumnHeader column={column} title="End Date" />,
    cell: ({ row }) => <div className="w-[185px]">{formatDate(row.original.endDate)}</div>,
  },
  {
    accessorKey: "Booking Status",
    accessorFn: ({ status }) => bookingStatusOptions[status],
    header: ({ column }) => <ColumnHeader column={column} title="Status" />,
    cell: ({ row }) => (
      <div className="w-[100px]">
        <Badge
          variant="outline"
          className={cn(
            bookingStatusColors[row.original.status],
            "rounded border-none ring-1 ring-inset",
          )}
        >
          {bookingStatusOptions[row.original.status]}
        </Badge>
      </div>
    ),
  },
  {
    accessorKey: "Payment Status",
    accessorFn: ({ paymentStatus }) => paymentStatusOptions[paymentStatus],
    header: ({ column }) => <ColumnHeader column={column} title="Payment Status" />,
    cell: ({ row }) => (
      <div className="w-[100px]">
        <Badge
          variant="outline"
          className={cn(
            paymentStatusColors[row.original.paymentStatus],
            "rounded border-none ring-1 ring-inset",
          )}
        >
          {paymentStatusOptions[row.original.paymentStatus]}
        </Badge>
      </div>
    ),
  },
  {
    accessorKey: "Net Total",
    enableColumnFilter: false,
    header: ({ column }) => <ColumnHeader column={column} title="Net Total" />,
    cell: ({ row }) => (
      <div className="w-[130px]">
        {row.original.netTotal
          ? new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(
              row.original.netTotal,
            )
          : "-"}
      </div>
    ),
  },
  // {
  //   accessorKey: "fleetOwnerPayoutAmountNet",
  //   enableColumnFilter: false,
  //   header: ({ column }) => <ColumnHeader column={column} title="Payout Amount" />,
  //   cell: ({ row }) => (
  //     <div className="w-[130px]">
  //       {typeof row.original.fleetOwnerPayoutAmountNet === "number" ||
  //       typeof row.original.fleetOwnerPayoutAmountNet === "string"
  //         ? new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(
  //             Number(row.original.fleetOwnerPayoutAmountNet),
  //           )
  //         : "-"}
  //     </div>
  //   ),
  // },
  {
    id: "actions",
    header: () => null,
    enableHiding: false,
    cell: ({ row }) => {
      const booking = row.original;
      const showAssignChauffeur = !booking.chauffeur && booking.status === "CONFIRMED";
      const showRefund = booking.status === "CANCELLED" && booking.paymentStatus !== "REFUNDED";

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
              <Link to={`/fleet-owner/bookings/${booking.id}?startDate=${booking.startDate}`}>
                View details
              </Link>
            </DropdownMenuItem>

            {showAssignChauffeur && (
              <DropdownMenuItem asChild>
                <Link to={`/fleet-owner/bookings/${booking.id}?startDate=${booking.startDate}`}>
                  Assign chauffeur
                </Link>
              </DropdownMenuItem>
            )}

            {showRefund && (
              <DropdownMenuItem asChild>
                <Link to={`/fleet-owner/bookings/${booking.id}/refund`}>Process refund</Link>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];

export default function BookingsPage() {
  const { bookings } = useLoaderData<typeof loader>();

  return (
    <div className="container mx-auto">
      <Table data={bookings} columns={columns} />
    </div>
  );
}
