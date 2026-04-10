import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { CheckBadgeIcon, CogIcon } from "@heroicons/react/24/outline";
import { parseFormData } from "@remix-run/form-data-parser";
import { BookingStatus } from "@prisma/client";
import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  data,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
} from "react-router";
import { ColumnDef } from "@tanstack/react-table";
import { PlusCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Form } from "~/components/CSRFForm";
import { ChauffeurRowActions } from "~/components/Table/ChauffuerRowActions";
import { ColumnHeader } from "~/components/Table/ColumnHeader";
import { LazyTable } from "~/components/Table/LazyTable";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";
import { useToast } from "~/hooks/use-toast";
import logger from "~/lib/logger.server";
import { cn, useIsPending } from "~/lib/utils";
import { requireUserWithRole } from "~/utils/server/permissions.server";
import { prisma } from "~/modules/db/db.server";
import { createUser } from "~/services/users.server";
import type { ChauffeurStatus, SerializedChauffeur } from "~/types";
import { validateCSRF } from "~/utils/csrf-action.server";
import { chauffeurSchema, chauffeurUpdateSchema } from "~/schemas/chauffeur.schema";

const statusColors: Record<ChauffeurStatus, string> = {
  ON_TRIP: "bg-blue-50 ring-blue-600/10 text-blue-600",
  AVAILABLE: "bg-green-50 ring-green-600/10 text-green-600",
  ASSIGNED: "bg-yellow-50 ring-yellow-600/10 text-yellow-600",
};

const chauffeurStatusOptions: Record<ChauffeurStatus, string> = {
  ON_TRIP: "On Trip",
  AVAILABLE: "Available",
  ASSIGNED: "Assigned",
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUserWithRole(request, "fleetOwner");

  // Check if owner-driver and redirect
  const fullUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { isOwnerDriver: true },
  });

  if (fullUser?.isOwnerDriver) {
    return redirect("/fleet-owner/cars");
  }

  const chauffeurs = await prisma.user.findMany({
    where: {
      fleetOwnerId: user.id,
      roles: {
        some: {
          name: "chauffeur",
        },
      },
    },
    // TODO: if assigned to a booking that is active, then show them as on trip
    // TODO: if assigned to a booking that starts tomorrow, then show them as assigned
    // TODO: if not assigned to a booking, cancelled or completed, then show them as available
    include: {
      bookingsAsChauffeur: {
        where: {
          status: {
            notIn: [BookingStatus.CANCELLED, BookingStatus.COMPLETED],
          },
          // endDate: {
          //   lte: new Date(new Date().setHours(23, 59, 59, 999)),
          // },
        },
        take: 1,
        orderBy: { startDate: "asc" },
        include: {
          car: {
            select: {
              make: true,
              model: true,
              year: true,
              registrationNumber: true,
            },
          },
        },
      },
    },
  });

  const serializedChauffeurs = chauffeurs.map((chauffeur) => ({
    id: chauffeur.id,
    name: chauffeur.name ?? "No name",
    email: chauffeur.email,
    address: chauffeur.address ?? "No address",
    phoneNumber: chauffeur.phoneNumber ?? "No phone number",
    status: (() => {
      const [booking] = chauffeur.bookingsAsChauffeur;

      if (!booking) {
        return "AVAILABLE";
      }

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const bookingStart = new Date(booking.startDate);

      if (booking.status === "ACTIVE") {
        return "ON_TRIP";
      }

      if (bookingStart >= tomorrow) {
        return "ASSIGNED";
      }

      return "AVAILABLE";
    })(),
    assignedCar: chauffeur.bookingsAsChauffeur[0]?.car
      ? {
          make: chauffeur.bookingsAsChauffeur[0]?.car.make,
          model: chauffeur.bookingsAsChauffeur[0]?.car.model,
          registrationNumber: chauffeur.bookingsAsChauffeur[0]?.car.registrationNumber,
        }
      : null,
    createdAt: chauffeur.createdAt.toISOString(),
    updatedAt: chauffeur.updatedAt.toISOString(),
    approvalStatus: chauffeur.chauffeurApprovalStatus ?? "PENDING",
  }));

  return { chauffeurs: serializedChauffeurs };
}

export async function action({ request }: ActionFunctionArgs) {
  await validateCSRF(request);
  const user = await requireUserWithRole(request, "fleetOwner");

  let formData: FormData;
  try {
    formData = await parseFormData(request, { maxFiles: 2 }, (file) => file);
  } catch (error) {
    logger.error({ error }, "Failed to parse chauffeur multipart form data");
    const message = "Unable to process uploaded documents. Please try again.";
    return data({ success: false, error: message }, { status: 400 });
  }
  const intentValue = formData.get("intent");
  const intent = typeof intentValue === "string" ? intentValue : "";

  if (!["create", "edit"].includes(intent)) {
    return data({ success: false, error: "Invalid intent" }, { status: 400 });
  }

  try {
    if (intent === "create") {
      const submission = parseWithZod(formData, { schema: chauffeurSchema });

      if (submission.status !== "success") {
        return data(submission.reply(), { status: 400 });
      }

      const { ninFile, drivingLicenceFile, ...userData } = submission.value;
      await createUser({
        ...userData,
        ninFile: ninFile as File,
        drivingLicenceFile: drivingLicenceFile as File,
        roles: { connect: [{ name: "chauffeur" }] },
        fleetOwner: { connect: { id: user.id } },
        autoApprove: false,
      });

      return { success: true, error: null };
    }

    if (intent === "edit") {
      const chauffeurIdValue = formData.get("chauffeurId");
      const chauffeurId = typeof chauffeurIdValue === "string" ? chauffeurIdValue : "";

      const submission = parseWithZod(formData, {
        schema: chauffeurUpdateSchema,
      });

      if (submission.status !== "success") {
        return data(submission.reply(), { status: 400 });
      }

      await prisma.user.update({
        where: { id: chauffeurId, fleetOwnerId: user.id },
        data: submission.value,
      });

      return { success: true, error: null };
    }
  } catch (error) {
    logger.error({ error }, `Failed to ${intent} chauffeur`);
    return data(
      {
        success: false,
        error: `Failed to ${intent} chauffeur`,
      },
      { status: 500 },
    );
  }
}

function ChauffeurForm() {
  const lastResult = useActionData<typeof action>();
  const isPending = useIsPending();
  const serverError = typeof lastResult?.error === "string" ? lastResult.error : undefined;

  const errorRingClasses = "border-red-500 focus-visible:ring-red-500 focus-visible:ring-2";

  const [form, { email, name, phoneNumber, address, ninFile, drivingLicenceFile }] = useForm({
    lastResult: lastResult && "status" in lastResult ? lastResult : undefined,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: chauffeurSchema });
    },
    shouldValidate: "onInput",
    shouldRevalidate: "onInput",
  });

  return (
    <Form
      method="post"
      {...getFormProps(form)}
      encType="multipart/form-data"
      className="space-y-4 w-full"
    >
      {serverError && <p className="text-red-500 text-sm">{serverError}</p>}

      <div className="space-y-1">
        <Label htmlFor={email.id}>Email</Label>
        <Input
          name={email.name}
          id={email.id}
          type="email"
          className={`rounded ${email.errors ? errorRingClasses : ""}`}
        />
        {email.errors && <p className="text-red-500 text-sm">{email.errors.join(" ")}</p>}
      </div>

      <div className="space-y-1">
        <Label htmlFor={name.id}>Name</Label>
        <Input
          name={name.name}
          id={name.id}
          className={`rounded ${name.errors ? errorRingClasses : ""}`}
        />
        {name.errors && <p className="text-red-500 text-sm">{name.errors.join(" ")}</p>}
      </div>

      <div className="space-y-1">
        <Label htmlFor={phoneNumber.id}>Phone Number</Label>
        <Input
          name={phoneNumber.name}
          id={phoneNumber.id}
          type="tel"
          placeholder="+2349012341234"
          className={`rounded ${phoneNumber.errors ? errorRingClasses : ""}`}
        />
        {phoneNumber.errors && (
          <p className="text-red-500 text-sm">{phoneNumber.errors.join(" ")}</p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor={address.id}>Address</Label>
        <Input
          name={address.name}
          id={address.id}
          className={`rounded ${address.errors ? errorRingClasses : ""}`}
        />
        {address.errors && <p className="text-red-500 text-sm">{address.errors.join(" ")}</p>}
      </div>

      <div className="space-y-1">
        <Label htmlFor={ninFile.id}>NIN Slip</Label>
        <Input
          {...getInputProps(ninFile, { type: "file" })}
          id={ninFile.id}
          accept="image/*"
          className={`rounded ${ninFile.errors ? errorRingClasses : ""}`}
        />
        {ninFile.errors && <p className="text-red-500 text-sm">{ninFile.errors.join(" ")}</p>}
      </div>

      <div className="space-y-1">
        <Label htmlFor={drivingLicenceFile.id}>Drivers Licence</Label>
        <Input
          {...getInputProps(drivingLicenceFile, { type: "file" })}
          id={drivingLicenceFile.id}
          accept="image/*"
          className={`rounded ${drivingLicenceFile.errors ? errorRingClasses : ""}`}
        />
        {drivingLicenceFile.errors && (
          <p className="text-red-500 text-sm">{drivingLicenceFile.errors.join(" ")}</p>
        )}
      </div>

      <input type="hidden" name="intent" value="create" />

      <Button type="submit" variant="default" className="w-full" disabled={isPending}>
        {isPending ? <CogIcon className="h-5 w-5 animate-spin" /> : "Add Chauffeur"}
      </Button>
    </Form>
  );
}

const columns: ColumnDef<SerializedChauffeur>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => <ColumnHeader column={column} title="Name" />,
    enableColumnFilter: false,
    cell: ({ row }) => (
      <div className="w-[150px] flex items-center gap-2">
        {row.original.name}
        {row.original.approvalStatus === "APPROVED" && (
          <CheckBadgeIcon className="h-5 w-5 text-green-500" title="Verified Chauffeur" />
        )}
      </div>
    ),
  },
  {
    accessorKey: "email",
    header: ({ column }) => <ColumnHeader column={column} title="Email" />,
    enableColumnFilter: false,
    cell: ({ row }) => <div className="w-[200px]">{row.original.email}</div>,
  },
  {
    accessorKey: "phoneNumber",
    enableColumnFilter: false,
    header: ({ column }) => <ColumnHeader column={column} title="Phone Number" />,
    cell: ({ row }) => <div className="w-[150px]">{row.original.phoneNumber}</div>,
  },
  {
    accessorKey: "assignedCar",
    enableColumnFilter: false,
    header: ({ column }) => <ColumnHeader column={column} title="Assigned Car" />,
    cell: ({ row: { original } }) => (
      <div className="w-[250px]">
        {original.assignedCar
          ? `${original.assignedCar.make} ${original.assignedCar.model} (${original.assignedCar.registrationNumber})`
          : "Not assigned"}
      </div>
    ),
  },
  {
    id: "status",
    accessorFn: ({ status }) => chauffeurStatusOptions[status],
    header: ({ column }) => <ColumnHeader column={column} title="Status" />,
    cell: ({ row }) => (
      <div className="w-[100px]">
        <Badge
          variant="outline"
          className={cn(statusColors[row.original.status], "rounded border-none ring-1 ring-inset")}
        >
          {row.getValue("status")}
        </Badge>
      </div>
    ),
  },
  {
    accessorKey: "approvalStatus",
    header: ({ column }) => <ColumnHeader column={column} title="Approval Status" />,
    cell: ({ row }) => (
      <div className="w-[150px]">
        <Badge
          variant="outline"
          className={cn(
            row.original.approvalStatus === "PENDING" &&
              "bg-yellow-50 text-yellow-600 ring-yellow-600/10",
            row.original.approvalStatus === "APPROVED" &&
              "bg-green-50 text-green-600 ring-green-600/10",
            row.original.approvalStatus === "REJECTED" && "bg-red-50 text-red-600 ring-red-600/10",
            "rounded border-none ring-1 ring-inset",
          )}
        >
          {row.original.approvalStatus.charAt(0) +
            row.original.approvalStatus.slice(1).toLowerCase()}
        </Badge>
      </div>
    ),
  },
  {
    id: "actions",
    header: () => null,
    enableHiding: false,
    cell: ({ row }) => <ChauffeurRowActions row={row} />,
  },
] as const;

export default function ChauffeursPage() {
  const { chauffeurs } = useLoaderData<typeof loader>();
  const [isOpen, setIsOpen] = useState(false);
  const navigation = useNavigation();
  const lastResult = useActionData<typeof action>();
  const { toast } = useToast();

  useEffect(() => {
    if (
      navigation.state === "idle" &&
      lastResult &&
      "success" in lastResult &&
      lastResult.success
    ) {
      setIsOpen(false);
      toast({
        title: "Success",
        description: "Chauffeur was successfully added",
        variant: "default",
      });
    }
  }, [navigation.state, lastResult, toast]);

  const addChauffeurAction = (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button type="button">
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Chauffeur
        </Button>
      </SheetTrigger>
      <SheetContent
        className="sm:max-w-[400px] w-full px-8 overflow-y-auto"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <SheetHeader>
          <SheetTitle>Add New Chauffeur</SheetTitle>
          <SheetDescription>
            Fill in the details to add a new chauffeur to your fleet.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4">
          <ChauffeurForm />
        </div>
      </SheetContent>
    </Sheet>
  );

  return (
    <div className="container mx-auto">
      <LazyTable data={chauffeurs} columns={columns} action={addChauffeurAction} />
    </div>
  );
}
