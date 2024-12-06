import { parseWithZod } from "@conform-to/zod";
import { Status } from "@prisma/client";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { ColumnDef } from "@tanstack/react-table";
import { PlusCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { ColumnHeader } from "~/components/Table/ColumnHeader";
import { RowActions } from "~/components/Table/RowActions";
import { Table } from "~/components/Table/Table";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";
import { useToast } from "~/hooks/use-toast";
import { cn } from "~/lib/utils";
import { requireUser } from "~/modules/auth/auth.server";
import { prisma } from "~/modules/db/db.server";
import { createCar } from "~/services/cars.server";
import { SerializedCar } from "~/types";
import { carSchema, NewCarForm } from "./fleet-owner.cars_.new";

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser(request);
  const formData = await request.formData();

  const intent = String(formData.get("intent"));

  if (!["create", "edit"].includes(intent)) {
    return json({ success: false, error: "Invalid intent" }, { status: 400 });
  }

  try {
    if (intent === "create") {
      const submission = parseWithZod(formData, { schema: carSchema });

      if (submission.status !== "success") {
        return json(submission.reply());
      }

      await createCar({
        ...submission.value,
        color: "Red",
        owner: { connect: { id: user.id } },
      });
    }

    if (intent === "edit") {
      const carId = String(formData.get("carId"));

      const submission = parseWithZod(formData, {
        schema: carSchema.omit({ images: true }),
      });

      if (submission.status !== "success") {
        return json(submission.reply());
      }

      await prisma.car.update({
        where: { id: carId },
        data: submission.value,
      });
    }

    return json({ success: true, error: null } as const);
  } catch (error) {
    console.error(error);
    return json(
      {
        success: false,
        error: `Failed to ${intent} car`,
      } as const,
      { status: 500 }
    );
  }
}

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const cars = await prisma.car.findMany({
    where: { ownerId: user.id },
    include: {
      owner: {
        select: {
          username: true,
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  const serializedCars = cars.map((car) => ({
    ...car,
    createdAt: car.createdAt.toISOString(),
    updatedAt: car.updatedAt.toISOString(),
    images: car.images || [],
    owner: {
      username: car.owner.username,
    },
  }));

  return json({ cars: serializedCars });
}

const formatPrice = (price: number) => {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
  }).format(price);
};

const statusColors: Record<Status, string> = {
  AVAILABLE: "bg-green-50 ring-green-600/10 text-green-600",
  BOOKED: "bg-blue-50 ring-blue-600/10 text-blue-600",
  HOLD: "bg-yellow-50 ring-yellow-600/10 text-yellow-600",
  IN_SERVICE: "bg-red-50 ring-red-600/10 text-red-600",
};

const carStatusOptions: Record<Status, string> = {
  AVAILABLE: "Available",
  BOOKED: "Booked",
  HOLD: "Hold",
  IN_SERVICE: "In Service",
};

export const columns: ColumnDef<SerializedCar>[] = [
  {
    accessorKey: "registrationNumber",
    header: ({ column }) => (
      <ColumnHeader column={column} title="Registration #" />
    ),
    enableColumnFilter: false,
    cell: ({ row }) => (
      <div className="w-[150px] font-medium">
        {row.original.registrationNumber}
      </div>
    ),
  },
  {
    accessorKey: "make",
    header: ({ column }) => <ColumnHeader column={column} title="Make" />,
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
    cell: ({ row }) => <div className="w-[150px]">{row.original.make}</div>,
  },
  {
    accessorKey: "model",
    header: ({ column }) => <ColumnHeader column={column} title="Model" />,
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
    cell: ({ row }) => <div className="w-[150px]">{row.original.model}</div>,
  },
  {
    accessorKey: "year",
    enableColumnFilter: false,
    header: ({ column }) => <ColumnHeader column={column} title="Year" />,
    cell: ({ row }) => <div className="w-[150px]">{row.original.year}</div>,
  },
  {
    accessorKey: "price",
    enableColumnFilter: false,
    header: ({ column }) => <ColumnHeader column={column} title="Price" />,
    cell: ({ row }) => (
      <div className="w-[150px]">{formatPrice(row.original.price)}</div>
    ),
  },
  {
    accessorKey: "status",
    accessorFn: ({ status }) => carStatusOptions[status],
    header: ({ column }) => <ColumnHeader column={column} title="Status" />,
    cell: ({ row }) => (
      <div className="w-[150px]">
        <Badge
          variant="outline"
          className={cn(
            statusColors[row.original.status],
            "rounded border-none ring-1 ring-inset"
          )}
        >
          {carStatusOptions[row.original.status]}
        </Badge>
      </div>
    ),
  },
  {
    id: "actions",
    cell: ({ row }) => <RowActions row={row} />,
    enableHiding: false,
  },
];

export default function CarsPage() {
  const { cars } = useLoaderData<typeof loader>();
  const [isOpen, setIsOpen] = useState(false);
  const fetcher = useFetcher<typeof action>({ key: "new-car" });
  const { toast } = useToast();

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.success) {
      setIsOpen(false);
      toast({
        title: "Success",
        description: "Car was successfully added",
        variant: "default",
      });
    }
  }, [fetcher.state, fetcher.data, toast]);

  return (
    <div className="container mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Cars</h1>
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Car
            </Button>
          </SheetTrigger>
          <SheetContent className="sm:max-w-[400px] px-8">
            <SheetHeader>
              <SheetTitle>Add New Car</SheetTitle>
              <SheetDescription>
                Fill in the details to add a new car to your fleet.
              </SheetDescription>
            </SheetHeader>
            <div className="mt-4">
              <NewCarForm />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <Table data={cars} columns={columns} />
    </div>
  );
}
