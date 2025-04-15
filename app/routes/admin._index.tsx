import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useSubmit } from "@remix-run/react";
import { Table } from "~/components/Table/Table";
import { requireAdminWithRedirect } from "~/modules/auth/auth.server";
import { prisma } from "~/modules/db/db.server";
import { createColumnHelper } from "@tanstack/react-table";
import { Link } from "@remix-run/react";
import { FleetOwnerStatus, User } from "@prisma/client";
import { Badge } from "~/components/ui/badge";
import { ColumnHeader } from "~/components/Table/ColumnHeader";
import { AdminFleetOwnerRowActions } from "~/components/Table/AdminRowActions";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdminWithRedirect(request);

  const fleetOwners = await prisma.user.findMany({
    where: {
      roles: {
        some: {
          name: "fleetOwner",
        },
      },
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

  return json({ fleetOwners });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireAdminWithRedirect(request);

  const formData = await request.formData();
  const { ownerId, status, intent } = Object.fromEntries(formData);

  if (typeof ownerId !== "string" || typeof status !== "string" || typeof intent !== "string") {
    return json({ success: false });
  }

  //   await prisma.user.update({
  //     where: { id: ownerId },
  //     data: {
  //       fleetOwnerStatus: status as FleetOwnerStatus,
  //     },
  //   });

  if (intent === "updateOwnerStatus") {
    // const { ownerId, status } = Object.fromEntries(formData);

    // if (typeof ownerId !== "string" || typeof status !== "string") {
    //   return json({ success: false });
    // }

    await prisma.user.update({
      where: { id: ownerId },
      data: {
        fleetOwnerStatus: status as FleetOwnerStatus,
      },
    });
  }

  return json({ success: true });
}

const columnHelper = createColumnHelper<User & { _count: { cars: number; chauffeurs: number } }>();

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
    cell: ({ row }) => {
      const submit = useSubmit();

      const handleUpdateStatus = (id: string, status: FleetOwnerStatus) => {
        const formData = new FormData();
        formData.append("ownerId", id);
        formData.append("status", status);
        submit(formData, { method: "POST" });
      };

      return <AdminFleetOwnerRowActions row={row} onUpdateStatus={handleUpdateStatus} />;
    },
  }),
] as const;

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
      <Table columns={columns} data={fleetOwners} />
    </div>
  );
}
