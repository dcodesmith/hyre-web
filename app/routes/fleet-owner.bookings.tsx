import { BookingStatus, PaymentStatus } from "@prisma/client";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
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

// const carSchema = z.object({
//   make: z
//     .string({
//       required_error: "Make is required.",
//     })
//     .min(1),
//   model: z
//     .string({
//       required_error: "Model is required.",
//     })
//     .min(1),
//   year: z
//     .number({
//       required_error: "Year is required.",
//     })
//     .int()
//     .min(2000, "Year must be 2000 or later")
//     .max(new Date().getFullYear() + 1, "Year cannot be in the future"),
//   price: z
//     .number({
//       required_error: "Price is required.",
//     })
//     .positive("Price must be positive"),
//   status: z.nativeEnum(Status, {
//     required_error: "Status is required.",
//   }),
// });

// export async function action({ request }: ActionFunctionArgs) {
//   const user = await requireUser(request);

//   const formData = await request.formData();

//   const submission = parseWithZod(formData, { schema: carSchema });

//   if (submission.status !== "success") {
//     return json(submission.reply());
//   }

//   const { make, model, year, price, status } = submission.value;

//   try {
//     await prisma.car.create({
//       data: {
//         make,
//         model,
//         year,
//         price,
//         color: "Red",
//         status,
//         ownerId: user.id,
//       },
//     });

//     return redirect("/fleet-owner/cars");
//   } catch (error) {
//     console.error("Error creating new car:", error);
//     return json({ error: "Failed to create new car" }, { status: 500 });
//   }
// }

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const bookings = await prisma.booking.findMany({
    where: {
      car: {
        ownerId: user.id,
      },
    },
    include: {
      car: true,
      user: true,
      chauffeur: true,
    },
  });

  return json({ bookings });
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
};

export default function BookingsPage() {
  const { bookings } = useLoaderData<typeof loader>();

  const columns: ColumnDef<(typeof bookings)[number]>[] = [
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
      accessorFn: ({ user }) => `${user.name || user.email || user.username}`,
      header: ({ column }) => <ColumnHeader column={column} title="Customer" />,
      cell: ({ row }) => {
        const user = row.original.user;
        return (
          <div className="w-[150px]">
            {user.name || user.email || user.username || "Unknown User"}
          </div>
        );
      },
    },
    {
      accessorKey: "chauffeur",
      accessorFn: ({ chauffeur }) => `${chauffeur?.name}`,
      header: ({ column }) => (
        <ColumnHeader column={column} title="Chauffeur" />
      ),
      cell: ({ row }) => {
        const chauffeur = row.original.chauffeur;
        return (
          <div className="w-[130px] text-wrap">
            {chauffeur?.name || "Not Assigned"}
          </div>
        );
      },
    },
    {
      accessorKey: "startDate",
      enableColumnFilter: false,
      header: ({ column }) => (
        <ColumnHeader column={column} title="Start Date" />
      ),
      cell: ({ row }) => (
        <div className="w-[185px]">{formatDate(row.original.startDate)}</div>
      ),
    },
    {
      accessorKey: "endDate",
      enableColumnFilter: false,
      header: ({ column }) => <ColumnHeader column={column} title="End Date" />,
      cell: ({ row }) => (
        <div className="w-[185px]">{formatDate(row.original.endDate)}</div>
      ),
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
              "rounded border-none ring-1 ring-inset"
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
      header: ({ column }) => (
        <ColumnHeader column={column} title="Payment Status" />
      ),
      cell: ({ row }) => (
        <div className="w-[100px]">
          <Badge
            variant="outline"
            className={cn(
              paymentStatusColors[row.original.paymentStatus],
              "rounded border-none ring-1 ring-inset"
            )}
          >
            {paymentStatusOptions[row.original.paymentStatus]}
          </Badge>
        </div>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const booking = row.original;
        const showAssignChauffeur =
          !booking.chauffeur && booking.status === "CONFIRMED";
        const showRefund =
          booking.status === "CANCELLED" &&
          booking.paymentStatus !== "REFUNDED";

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
                <Link
                  to={`/fleet-owner/bookings/${booking.id}?startDate=${booking.startDate}`}
                >
                  View details
                </Link>
              </DropdownMenuItem>

              {showAssignChauffeur && (
                <DropdownMenuItem asChild>
                  <Link
                    to={`/fleet-owner/bookings/${booking.id}?startDate=${booking.startDate}`}
                  >
                    Assign chauffeur
                  </Link>
                </DropdownMenuItem>
              )}

              {showRefund && (
                <DropdownMenuItem asChild>
                  <Link to={`/fleet-owner/bookings/${booking.id}/refund`}>
                    Process refund
                  </Link>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return (
    <div className="container mx-auto">
      <Table data={bookings} columns={columns} />
    </div>
  );
}
