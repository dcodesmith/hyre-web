import { parseWithZod } from "@conform-to/zod/v4";
import { FleetOwnerStatus, User } from "@prisma/client";
import { type ActionFunctionArgs, type LoaderFunctionArgs, data } from "@remix-run/node";
import { Link, useLoaderData, useSubmit } from "@remix-run/react";
import { createColumnHelper, Row } from "@tanstack/react-table";
import { useAuthenticityToken } from "remix-utils/csrf/react";
import { z } from "zod";
import { AdminFleetOwnerRowActions } from "~/components/Table/AdminRowActions";
import { ColumnHeader } from "~/components/Table/ColumnHeader";
import { Table } from "~/components/Table/Table";
import { Badge } from "~/components/ui/badge";
import { requireAdminOrStaffWithRedirect } from "~/modules/auth/auth.server";
import { prisma } from "~/modules/db/db.server";
import { validateCSRF } from "~/utils/csrf-action.server";
import { UpdateOwnerStatusSchema } from "~/schemas/admin.schema";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdminOrStaffWithRedirect(request);

  const fleetOwners = await prisma.user.findMany({
    where: {
      roles: {
        some: {
          name: "fleetOwner",
        },
      },
      hasOnboarded: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      fleetOwnerStatus: true,
      _count: {
        select: {
          cars: true,
          chauffeurs: true,
        },
      },
    },
  });

  return { fleetOwners };
}

export async function action({ request }: ActionFunctionArgs) {
  await validateCSRF(request);
  await requireAdminOrStaffWithRedirect(request);

  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema: UpdateOwnerStatusSchema });

  if (submission.status !== "success") {
    return data(
      {
        success: false,
        error: "Invalid form data",
        submission: submission.reply(),
      },
      { status: 400 },
    );
  }

  const { ownerId, status, intent } = submission.value;

  if (intent === "updateOwnerStatus") {
    await prisma.user.update({
      where: { id: ownerId },
      data: {
        fleetOwnerStatus: status,
      },
    });
  }

  return { success: true };
}

type FleetOwner = User & { _count: { cars: number; chauffeurs: number } };

const columnHelper = createColumnHelper<FleetOwner>();

const statusColorMap: Record<FleetOwnerStatus, string> = {
  PROCESSING: "text-yellow-600 border-yellow-600",
  APPROVED: "text-green-600 border-green-600",
  ON_HOLD: "text-orange-600 border-orange-600",
  ARCHIVED: "text-gray-600 border-gray-600",
};

const statusTextMap: Record<FleetOwnerStatus, string> = {
  PROCESSING: "Processing",
  APPROVED: "Approved",
  ON_HOLD: "On Hold",
  ARCHIVED: "Archived",
};

const columns = [
  columnHelper.accessor("name", {
    enableColumnFilter: false,
    header: ({ column }) => <ColumnHeader column={column} title="Name" />,
    cell: (info) => info.getValue(),
  }),
  columnHelper.accessor("fleetOwnerStatus", {
    header: ({ column }) => <ColumnHeader column={column} title="Status" />,
    cell: ({
      row: {
        original: { fleetOwnerStatus },
      },
    }) => {
      if (!fleetOwnerStatus) {
        return;
      }
      return (
        <Badge variant="outline" className={statusColorMap[fleetOwnerStatus]}>
          {statusTextMap[fleetOwnerStatus]}
        </Badge>
      );
    },
  }),
  columnHelper.accessor("_count.cars", {
    enableColumnFilter: false,
    header: ({ column }) => <ColumnHeader column={column} title="Total Cars" />,
    cell: (info) => (
      <Link
        to={`/admin/owners/${info.row.original.id}/cars`}
        className="text-blue-600 hover:underline"
      >
        {info.getValue()}
      </Link>
    ),
  }),
  columnHelper.accessor("_count.chauffeurs", {
    enableColumnFilter: false,
    header: ({ column }) => <ColumnHeader column={column} title="Total Chauffeurs" />,
    cell: (info) => (
      <Link
        to={`/admin/owners/${info.row.original.id}/chauffeurs`}
        className="text-blue-600 hover:underline"
      >
        {info.getValue()}
      </Link>
    ),
  }),
  columnHelper.accessor("createdAt", {
    header: ({ column }) => <ColumnHeader column={column} title="Joined Date" />,
    cell: (info) => new Date(info.getValue()).toLocaleDateString(),
    enableColumnFilter: false,
  }),
  columnHelper.accessor("id", {
    enableColumnFilter: false,
    header: "Actions",
    cell: ({ row }) => <FleetOwnerActionsCell row={row} />,
  }),
] as const;

function FleetOwnerActionsCell({ row }: { readonly row: Row<FleetOwner> }) {
  const submit = useSubmit();
  const csrfToken = useAuthenticityToken();

  const handleUpdateStatus = (id: string, status: FleetOwnerStatus) => {
    const formData = new FormData();
    formData.append("ownerId", id);
    formData.append("status", status);
    formData.append("csrf", csrfToken);
    formData.append("intent", "updateOwnerStatus");
    submit(formData, { method: "POST" });
  };

  return <AdminFleetOwnerRowActions row={row} onUpdateStatus={handleUpdateStatus} />;
}

export const handle = {
  breadcrumb: () => ({
    label: "Fleet Owners",
    path: "/admin",
  }),
};

export default function AdminDashboard() {
  const { fleetOwners } = useLoaderData<typeof loader>();

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Fleet Owners</h1>
      <Table hideColumnViewOptions columns={columns} data={fleetOwners} />
    </div>
  );
}
