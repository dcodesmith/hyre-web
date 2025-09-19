import { Car, CarApprovalStatus, FleetOwnerStatus, Status } from "@prisma/client";
import { type ActionFunctionArgs, type LoaderFunctionArgs, data } from "@remix-run/node";
import { Link, useLoaderData, useSubmit } from "@remix-run/react";
import { createColumnHelper } from "@tanstack/react-table";
import { AlertCircle } from "lucide-react";
import { useAuthenticityToken } from "remix-utils/csrf/react";
import { z } from "zod";
import { parseWithZod } from "@conform-to/zod";
import { AdminCarRowActions } from "~/components/Table/AdminRowActions";
import { ColumnHeader } from "~/components/Table/ColumnHeader";
import { Table } from "~/components/Table/Table";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { requireAdminOrStaffWithRedirect } from "~/modules/auth/auth.server";
import { prisma } from "~/modules/db/db.server";
import { validateCSRF } from "~/utils/csrf-action.server";

// Validation schemas
const updateCarStatusSchema = z.object({
  intent: z.literal("updateCarStatus"),
  carId: z.string().min(1, "Car ID is required"),
  status: z.nativeEnum(CarApprovalStatus, {
    required_error: "Car approval status is required",
    invalid_type_error: "Invalid car approval status",
  }),
});

const updateOwnerStatusSchema = z.object({
  intent: z.literal("updateOwnerStatus"),
  status: z.nativeEnum(FleetOwnerStatus, {
    required_error: "Fleet owner status is required",
    invalid_type_error: "Invalid fleet owner status",
  }),
});

const actionSchema = z.discriminatedUnion("intent", [
  updateCarStatusSchema,
  updateOwnerStatusSchema,
]);

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireAdminOrStaffWithRedirect(request);

  const owner = await prisma.user.findUnique({
    where: { id: params.id },
    include: {
      cars: true,
    },
  });

  if (!owner) {
    throw new Response("Not Found", { status: 404 });
  }

  return { owner };
}

export async function action({ request, params }: ActionFunctionArgs) {
  await validateCSRF(request);
  await requireAdminOrStaffWithRedirect(request);

  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema: actionSchema });
  const ownerId = params.id;

  if (submission.status !== "success") {
    return data(
      {
        success: false,
        error: "Validation failed",
        submission: submission.reply(),
      },
      { status: 400 },
    );
  }

  const { intent } = submission.value;

  if (intent === "updateCarStatus") {
    const { carId, status } = submission.value;

    const { count } = await prisma.car.updateMany({
      where: { id: carId, ownerId },
      data: {
        approvalStatus: status,
      },
    });

    if (count === 0) {
      return data({ success: false, error: "Car not found" }, { status: 404 });
    }
  }

  if (intent === "updateOwnerStatus") {
    const { status } = submission.value;

    await prisma.user.update({
      where: { id: ownerId },
      data: {
        fleetOwnerStatus: status,
      },
    });
  }

  return { success: true };
}

const statusColorMap: Record<CarApprovalStatus, string> = {
  PENDING: "text-yellow-600 border-yellow-600",
  APPROVED: "text-green-600 border-green-600",
  REJECTED: "text-red-600 border-red-600",
};

const statusTextMap: Record<CarApprovalStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
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

const columnHelper = createColumnHelper<Car>();

const columns = [
  columnHelper.accessor("make", {
    header: ({ column }) => <ColumnHeader column={column} title="Make & Model" />,
    cell: ({ row }) => (
      <Link
        to={`/admin/owners/${row.original.ownerId}/cars/${row.original.id}`}
        className="text-blue-600 hover:text-blue-800"
      >
        {row.original.make} {row.original.model}
      </Link>
    ),
  }),
  columnHelper.accessor("year", {
    header: ({ column }) => <ColumnHeader column={column} title="Year" />,
    enableColumnFilter: false,
    // cell: (info) => new Date(info.getValue()).toLocaleDateString(),
  }),
  columnHelper.accessor("approvalStatus", {
    header: ({ column }) => <ColumnHeader column={column} title="Approval Status" />,
    cell: ({
      row: {
        original: { approvalStatus },
      },
    }) => (
      <Badge variant="outline" className={statusColorMap[approvalStatus]}>
        {statusTextMap[approvalStatus]}
      </Badge>
    ),
  }),
  columnHelper.accessor("status", {
    header: ({ column }) => <ColumnHeader column={column} title="Car Status" />,
    cell: ({
      row: {
        original: { status },
      },
    }) => (
      <Badge variant="outline" className={statusColors[status]}>
        {carStatusOptions[status]}
      </Badge>
    ),
  }),
  columnHelper.accessor("id", {
    header: "Actions",
    enableColumnFilter: false,
    cell: ({ row }) => {
      const submit = useSubmit();
      const csrfToken = useAuthenticityToken();

      const handleUpdateStatus = (id: string, status: CarApprovalStatus) => {
        const formData = new FormData();
        formData.append("intent", "updateCarStatus");
        formData.append("carId", id);
        formData.append("status", status);
        formData.append("csrf", csrfToken);
        submit(formData, { method: "POST" });
      };

      return <AdminCarRowActions row={row} onUpdateStatus={handleUpdateStatus} />;
    },
  }),
];

const fleetOwnerstatusColors: Record<FleetOwnerStatus, string> = {
  PROCESSING: "text-yellow-600 border-yellow-600",
  APPROVED: "text-green-600 border-green-600",
  ON_HOLD: "text-orange-600 border-orange-600",
  ARCHIVED: "text-gray-600 border-gray-600",
};

const fleetOwnerStatusOptions: Record<FleetOwnerStatus, string> = {
  PROCESSING: "Processing",
  APPROVED: "Approved",
  ON_HOLD: "On Hold",
  ARCHIVED: "Archived",
};

export default function OwnerDetails() {
  const { owner } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const csrfToken = useAuthenticityToken();

  const handleStatusUpdate = (status: FleetOwnerStatus) => {
    if (
      window.confirm(
        `Are you sure you want to change this fleet owner's status to ${status.toLowerCase()}?`,
      )
    ) {
      submit(
        { status, intent: "updateOwnerStatus", ownerId: owner.id, csrf: csrfToken },
        { method: "POST" },
      );
    }
  };

  return (
    <div className="p-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold mb-2">{owner.name}'s Fleet</h1>

          <div className="text-gray-600 flex items-center gap-2">
            {owner.email}

            {owner.fleetOwnerStatus && (
              <Badge variant="outline" className={fleetOwnerstatusColors[owner.fleetOwnerStatus]}>
                {fleetOwnerStatusOptions[owner.fleetOwnerStatus]}
              </Badge>
            )}
          </div>
        </div>

        {owner.cars.some((car) => car.approvalStatus === "APPROVED") ? (
          <>
            {owner.fleetOwnerStatus === "APPROVED" ? (
              <Button
                onClick={() => handleStatusUpdate("ON_HOLD")}
                className="bg-yellow-600 hover:bg-yellow-700 text-white w-full md:w-auto"
              >
                Put on Hold
              </Button>
            ) : (
              <Button
                onClick={() => handleStatusUpdate("APPROVED")}
                className="bg-green-600 hover:bg-green-700 text-white w-full md:w-auto"
              >
                Approve Fleet Owner
              </Button>
            )}
          </>
        ) : (
          <div className="text-yellow-600 border border-yellow-600 p-2 flex items-center gap-2 text-sm w-full md:w-auto">
            <AlertCircle className="shrink-0" />
            <span>At least 1 car must be approved before we can approve this fleet owner</span>
          </div>
        )}
      </div>

      <Table
        columns={columns}
        data={owner.cars}
        initialSorting={[
          {
            id: "approvalStatus",
            desc: false,
          },
        ]}
      />
    </div>
  );
}
