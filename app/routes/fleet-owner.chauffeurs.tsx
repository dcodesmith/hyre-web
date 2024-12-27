import { getFormProps, useForm } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod";
import { CogIcon } from "@heroicons/react/24/outline";
import { BookingStatus } from "@prisma/client";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { ActionFunctionArgs, json } from "@remix-run/node";
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
} from "@remix-run/react";
import { ColumnDef } from "@tanstack/react-table";
import { PlusCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { ChauffeurRowActions } from "~/components/Table/ChauffuerRowActions";
import { ColumnHeader } from "~/components/Table/ColumnHeader";
import { Table } from "~/components/Table/Table";
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
import { cn, useIsPending } from "~/lib/utils";
import { requireUser } from "~/modules/auth/auth.server";
import { prisma } from "~/modules/db/db.server";
import { createUser } from "~/services/users.server";
import type { ChauffeurStatus, SerializedChauffeur } from "~/types";

const chauffeurSchema = z.object({
  email: z
    .string({
      required_error: "Email is required.",
    })
    .min(1),
  name: z
    .string({
      required_error: "Name is required.",
    })
    .min(1),
  phoneNumber: z
    .string({
      required_error: "Phone is required.",
    })
    .min(11, "Phone number must be at least 11 digits"),
  address: z.string({
    required_error: "Address is required.",
  }),
});

const statusColors: Record<ChauffeurStatus, string> = {
  ON_TRIP: "bg-blue-50 ring-blue-600/10 text-blue-600",
  AVAILABLE: "bg-green-50 ring-green-600/10 text-green-600",
};

const chauffeurStatusOptions: Record<ChauffeurStatus, string> = {
  ON_TRIP: "On Trip",
  AVAILABLE: "Available",
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);

  const chauffeurs = await prisma.user.findMany({
    where: {
      fleetOwnerId: user.id,
      roles: {
        some: {
          name: "chauffeur",
        },
      },
    },
    include: {
      bookingsAsChauffeur: {
        where: {
          status: {
            notIn: [BookingStatus.CANCELLED, BookingStatus.COMPLETED],
          },
        },
        take: 1,
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

  const serializedChauffeurs: SerializedChauffeur[] = chauffeurs.map(
    (chauffeur) => ({
      id: chauffeur.id,
      name: chauffeur.name ?? "No name",
      email: chauffeur.email,
      address: chauffeur.address ?? "No address",
      phoneNumber: chauffeur.phoneNumber ?? "No phone number",
      status:
        chauffeur.bookingsAsChauffeur.length > 0 ? "ON_TRIP" : "AVAILABLE",
      assignedCar: chauffeur.bookingsAsChauffeur[0]?.car
        ? {
            make: chauffeur.bookingsAsChauffeur[0]?.car.make,
            model: chauffeur.bookingsAsChauffeur[0]?.car.model,
            registrationNumber:
              chauffeur.bookingsAsChauffeur[0]?.car.registrationNumber,
          }
        : null,
      createdAt: chauffeur.createdAt.toISOString(),
      updatedAt: chauffeur.updatedAt.toISOString(),
    })
  );

  return json({ chauffeurs: serializedChauffeurs });
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser(request);
  const formData = await request.formData();

  const intent = String(formData.get("intent"));

  if (!["create", "edit"].includes(intent)) {
    return json({ error: "Invalid intent" }, { status: 400 });
  }

  try {
    if (intent === "create") {
      const submission = parseWithZod(formData, { schema: chauffeurSchema });

      if (submission.status !== "success") {
        return json(submission.reply());
      }

      await createUser({
        ...submission.value,
        roles: { connect: [{ name: "chauffeur" }] },
        fleetOwner: { connect: { id: user.id } },
      });

      return json({ success: true, error: null });
    }

    if (intent === "edit") {
      const chauffeurId = String(formData.get("chauffeurId"));
      console.log("edit", chauffeurId);

      const submission = parseWithZod(formData, {
        schema: chauffeurSchema, //.pick({ phoneNumber: true, address: true }),
      });

      if (submission.status !== "success") {
        return json(submission.reply());
      }

      console.log("submission", submission.value);

      await prisma.user.update({
        where: { id: chauffeurId, fleetOwnerId: user.id },
        data: submission.value,
      });
    }

    return json({ success: true, error: null } as const);
  } catch (error) {
    console.error(error);
    return json(
      {
        success: false,
        error: `Failed to ${intent} chauffeur`,
      },
      { status: 500 }
    );
  }
}

function ChauffeurForm() {
  const lastResult = useActionData<typeof action>();
  const navigation = useNavigation();
  const isPending = useIsPending();
  const serverError = lastResult?.error;

  const errorRingClasses =
    "border-red-500 focus-visible:ring-red-500 focus-visible:ring-2";

  const [form, { email, name, phoneNumber, address }] = useForm({
    lastResult,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: chauffeurSchema });
    },
    shouldValidate: "onInput",
    shouldRevalidate: "onInput",
  });

  const isSubmitting = navigation.state === "submitting";

  return (
    <Form method="post" {...getFormProps(form)} className="space-y-4">
      {serverError && <p className="text-red-500 text-sm">{serverError}</p>}

      <div className="space-y-1">
        <Label htmlFor={email.id}>Email</Label>
        <Input
          name={email.name}
          id={email.id}
          type="email"
          className={`rounded ${email.errors ? errorRingClasses : ""}`}
        />
        {email.errors && (
          <p className="text-red-500 text-sm">{email.errors.join(" ")}</p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor={name.id}>Name</Label>
        <Input
          name={name.name}
          id={name.id}
          className={`rounded ${name.errors ? errorRingClasses : ""}`}
        />
        {name.errors && (
          <p className="text-red-500 text-sm">{name.errors.join(" ")}</p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor={phoneNumber.id}>Phone Number</Label>
        <Input
          name={phoneNumber.name}
          id={phoneNumber.id}
          type="tel"
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
        {address.errors && (
          <p className="text-red-500 text-sm">{address.errors.join(" ")}</p>
        )}
      </div>

      <input type="hidden" name="intent" value="create" />

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isPending ? (
          <CogIcon className="h-5 w-5 animate-spin" />
        ) : (
          "Add Chauffeur"
        )}
      </Button>
    </Form>
  );
}

export default function ChauffeursPage() {
  const { chauffeurs } = useLoaderData<typeof loader>();
  const [isOpen, setIsOpen] = useState(false);
  const navigation = useNavigation();
  const lastResult = useActionData<typeof action>();
  const { toast } = useToast();

  const columns = useMemo<ColumnDef<SerializedChauffeur>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => <ColumnHeader column={column} title="Name" />,
        enableColumnFilter: false,
        cell: ({ row }) => <div className="w-[150px]">{row.original.name}</div>,
      },
      {
        accessorKey: "email",
        header: ({ column }) => <ColumnHeader column={column} title="Email" />,
        enableColumnFilter: false,
        cell: ({ row }) => (
          <div className="w-[200px]">{row.original.email}</div>
        ),
      },
      {
        accessorKey: "phoneNumber",
        enableColumnFilter: false,
        header: ({ column }) => (
          <ColumnHeader column={column} title="Phone Number" />
        ),
        cell: ({ row }) => (
          <div className="w-[150px]">{row.original.phoneNumber}</div>
        ),
      },
      {
        accessorKey: "assignedCar",
        enableColumnFilter: false,
        header: ({ column }) => (
          <ColumnHeader column={column} title="Assigned Car" />
        ),
        cell: ({ row: { original } }) => (
          <div className="w-[250px]">
            {original.assignedCar
              ? `${original.assignedCar.make} ${original.assignedCar.model} (${original.assignedCar.registrationNumber})`
              : "Not assigned"}
          </div>
        ),
      },
      {
        accessorKey: "status",
        accessorFn: ({ status }) => chauffeurStatusOptions[status],
        header: ({ column }) => <ColumnHeader column={column} title="Status" />,
        cell: ({ row }) => (
          <div className="w-[100px]">
            <Badge
              variant="outline"
              className={cn(
                statusColors[row.original.status],
                "rounded border-none ring-1 ring-inset"
              )}
            >
              {chauffeurStatusOptions[row.original.status]}
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
    ],
    []
  );

  useEffect(() => {
    if (navigation.state === "idle" && lastResult?.success) {
      setIsOpen(false);
      toast({
        title: "Success",
        description: "Chauffeur was successfully added",
        variant: "default",
      });
    }
  }, [navigation.state, lastResult, toast]);

  return (
    <div className="container mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Chauffeurs</h1>
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Chauffeur
            </Button>
          </SheetTrigger>
          <SheetContent>
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
      </div>
      <Table data={chauffeurs} columns={columns} />
    </div>
  );
}
