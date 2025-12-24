import { parseWithZod } from "@conform-to/zod/v4";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import {
  data,
  unstable_createMemoryUploadHandler,
  unstable_parseMultipartFormData,
} from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { ColumnDef } from "@tanstack/react-table";
import { CheckCircle2, PlusCircle } from "lucide-react";
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
import { cn, formatCurrency } from "~/lib/utils";
import { requireUserWithRole } from "~/utils/server/permissions.server";
import { prisma } from "~/modules/db/db.server";
import { createCar, hasReachedOwnerDriverCarLimit } from "~/services/cars.server";
import { validateCSRF } from "~/utils/csrf-action.server";
import { NewCarForm } from "./fleet-owner.cars_.new";
import { carSchema } from "~/schemas/car.schema";
import { SerializedCar } from "~/types";
import logger from "~/lib/logger.server";
import { User } from "@prisma/client";

const Status = {
  AVAILABLE: "AVAILABLE",
  BOOKED: "BOOKED",
  HOLD: "HOLD",
  IN_SERVICE: "IN_SERVICE",
} as const;

type ActionResponse = { success: boolean; error?: string | null } | undefined;

/**
 * Thin wrapper that converts the business rule check into a Remix response.
 * This keeps the domain rule (hasReachedOwnerDriverCarLimit) independent of Remix.
 */
async function checkOwnerDriverCarLimitResponse(userId: string) {
  const hasReachedLimit = await hasReachedOwnerDriverCarLimit(userId);

  if (hasReachedLimit) {
    return data(
      {
        success: false,
        error:
          "Owner-drivers can only have 1 car. Please delete your existing car first or contact support to upgrade to a fleet owner account.",
      },
      { status: 400 },
    );
  }

  return null;
}

async function handleCreateCar(formData: FormData, user: User & { roles: { name: string }[] }) {
  // Enforce 1-car limit for owner-drivers
  if (user.isOwnerDriver) {
    const limitCheck = await checkOwnerDriverCarLimitResponse(user.id);
    if (limitCheck) return limitCheck;
  }

  const submission = parseWithZod(formData, { schema: carSchema });

  if (submission.status !== "success") {
    return data(submission.reply(), { status: 400 });
  }

  const { motCertificate, insuranceCertificate, ...rest } = submission.value;

  await createCar({
    ...rest,
    color: "",
    owner: { connect: { id: user.id } },
    motCertificate: motCertificate as File,
    insuranceCertificate: insuranceCertificate as File,
    autoApprove: false,
  });

  return data({ success: true }, { status: 200 });
}

async function handleEditCar(formData: FormData, user: User & { roles: { name: string }[] }) {
  const carId = String(formData.get("carId"));

  const submission = parseWithZod(formData, {
    schema: carSchema.omit({ images: true, motCertificate: true, insuranceCertificate: true }),
  });

  if (submission.status !== "success") {
    return data(submission.reply(), { status: 400 });
  }

  await prisma.car.update({
    where: { id: carId, ownerId: user.id },
    data: submission.value,
  });

  return data({ success: true }, { status: 200 });
}

export async function action({ request }: ActionFunctionArgs) {
  await validateCSRF(request);

  const user = await requireUserWithRole(request, "fleetOwner");

  // Clone the request to peek at the intent without consuming the stream
  const clonedRequest = request.clone();
  const tempFormData = await clonedRequest.formData();
  const intentValue = tempFormData.get("intent");
  const intent = typeof intentValue === "string" ? intentValue : "";

  if (!["create", "edit"].includes(intent)) {
    return data({ success: false, error: "Invalid intent" }, { status: 400 });
  }

  // Parse form data based on intent
  let formData: FormData;

  if (intent === "create") {
    const uploadHandler = unstable_createMemoryUploadHandler({
      maxPartSize: 10 * 1024 * 1024, // 10MB limit
    });
    formData = await unstable_parseMultipartFormData(request, uploadHandler);
  } else {
    formData = await request.formData();
  }

  try {
    if (intent === "create") {
      return await handleCreateCar(formData, user);
    }

    if (intent === "edit") {
      return await handleEditCar(formData, user);
    }
  } catch (error) {
    logger.error({ error }, `Failed to ${intent} car`);
    return data(
      {
        success: false,
        error: `Failed to ${intent} car`,
      } as const,
      { status: 500 },
    );
  }
}

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUserWithRole(request, "fleetOwner");

  const cars = await prisma.car.findMany({
    where: { ownerId: user.id },
    include: {
      owner: {
        select: {
          username: true,
          name: true,
        },
      },
      images: {
        select: { url: true },
      },
      documents: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  // Serialize dates for client
  const serializedCars = cars.map((car) => ({
    ...car,
    createdAt: car.createdAt.toISOString(),
    updatedAt: car.updatedAt.toISOString(),
    documents: car.documents.map((doc) => ({
      ...doc,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
      approvedAt: doc.approvedAt?.toISOString() ?? null,
    })),
  }));

  // Check if owner-driver can add more cars (max 1)
  const canAddCar = !user.isOwnerDriver || !(await hasReachedOwnerDriverCarLimit(user.id));

  return { cars: serializedCars, canAddCar, isOwnerDriver: user.isOwnerDriver };
}

const statusColors: Record<(typeof Status)[keyof typeof Status], string> = {
  AVAILABLE: "bg-green-50 ring-green-600/10 text-green-600",
  BOOKED: "bg-blue-50 ring-blue-600/10 text-blue-600",
  HOLD: "bg-yellow-50 ring-yellow-600/10 text-yellow-600",
  IN_SERVICE: "bg-red-50 ring-red-600/10 text-red-600",
};

const carStatusOptions: Record<(typeof Status)[keyof typeof Status], string> = {
  AVAILABLE: "Available",
  BOOKED: "Booked",
  HOLD: "Hold",
  IN_SERVICE: "In Service",
};

export const columns: ColumnDef<SerializedCar>[] = [
  {
    accessorKey: "registrationNumber",
    header: ({ column }) => <ColumnHeader column={column} title="Registration #" />,
    enableColumnFilter: false,
    cell: ({ row }) => (
      <div className="w-[150px] font-medium flex items-center gap-2">
        {row.original.registrationNumber}
        {row.original.approvalStatus === "APPROVED" && (
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        )}
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
    cell: ({ row }) => <div className="w-[100px]">{row.original.year}</div>,
  },
  {
    accessorKey: "dayRate",
    enableColumnFilter: false,
    header: ({ column }) => <ColumnHeader column={column} title="Daily Rate" />,
    cell: ({ row }) => <div className="w-[150px]">{formatCurrency(row.original.dayRate)}</div>,
  },
  {
    accessorKey: "hourlyRate",
    enableColumnFilter: false,
    header: ({ column }) => <ColumnHeader column={column} title="Hourly Rate" />,
    cell: ({ row }) => <div className="w-[150px]">{formatCurrency(row.original.hourlyRate)}</div>,
  },
  {
    accessorKey: "nightRate",
    enableColumnFilter: false,
    header: ({ column }) => <ColumnHeader column={column} title="Nightly Rate" />,
    cell: ({ row }) => <div className="w-[150px]">{formatCurrency(row.original.nightRate)}</div>,
  },
  {
    accessorKey: "fullDayRate",
    enableColumnFilter: false,
    header: ({ column }) => <ColumnHeader column={column} title="24-Hour Rate" />,
    cell: ({ row }) => <div className="w-[150px]">{formatCurrency(row.original.fullDayRate)}</div>,
  },
  {
    accessorKey: "fuelUpgradeRate",
    enableColumnFilter: false,
    header: ({ column }) => <ColumnHeader column={column} title="Fuel Upgrade Rate" />,
    cell: ({ row }) => (
      <div className="w-[150px]">{formatCurrency(row.original.fuelUpgradeRate)}</div>
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
          className={cn(statusColors[row.original.status], "rounded border-none ring-1 ring-inset")}
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
  const { cars, canAddCar, isOwnerDriver } = useLoaderData<typeof loader>();
  const [isOpen, setIsOpen] = useState(false);
  const fetcher = useFetcher<ActionResponse>({ key: "new-car" });
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

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.error) {
      toast({
        title: "Error",
        description: fetcher.data.error,
        variant: "destructive",
      });
    }
  }, [fetcher.state, fetcher.data, toast]);

  return (
    <div className="container mx-auto">
      <div className="flex justify-between items-center mb-2">
        {canAddCar ? (
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button className="sm:w-auto w-full ml-auto">
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Car
              </Button>
            </SheetTrigger>
            <SheetContent className="sm:max-w-[400px] w-full px-8 overflow-y-auto">
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
        ) : (
          <div className="ml-auto text-sm text-muted-foreground">
            {isOwnerDriver && cars.length > 0 && (
              <p>
                Owner-drivers can only have 1 car. Delete your existing car to add a different one.
              </p>
            )}
          </div>
        )}
      </div>

      <Table data={cars} columns={columns} />
    </div>
  );
}
