import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useSubmit, useActionData, useNavigation } from "@remix-run/react";
import { Table } from "~/components/Table/Table";
import { requireAdminWithRedirect } from "~/modules/auth/auth.server";
import { prisma } from "~/modules/db/db.server";
import { createColumnHelper } from "@tanstack/react-table";
import { Link } from "@remix-run/react";
import { Badge } from "~/components/ui/badge";
import { ChauffeurApprovalStatus, User } from "@prisma/client";
import { ColumnHeader } from "~/components/Table/ColumnHeader";
import { Button } from "~/components/ui/button";
import { CircleAlertIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Form } from "@remix-run/react";
// import { useToast } from "~/components/ui/use-toast";
import { useEffect } from "react";
import { cn } from "~/lib/utils";
import { MoreHorizontal } from "lucide-react";
import { useToast } from "~/hooks/use-toast";
import { ChauffeurStatus } from "~/types";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const owner = await prisma.user.findUnique({
    where: { id: params.id },
    include: {
      chauffeurs: {
        include: {
          bookingsAsChauffeur: {
            where: {
              status: {
                in: ["CONFIRMED", "ACTIVE"],
              },
            },
            take: 1,
          },
        },
      },
    },
  });

  if (!owner) {
    throw new Response("Not Found", { status: 404 });
  }

  return json({ owner });
}

export async function action({ request, params }: ActionFunctionArgs) {
  await requireAdminWithRedirect(request);

  const formData = await request.formData();
  const intent = String(formData.get("intent"));
  const chauffeurId = String(formData.get("chauffeurId"));
  const status = String(formData.get("status")) as "APPROVED" | "REJECTED" | "PENDING";

  if (intent !== "updateApprovalStatus" || !chauffeurId || !status) {
    return json({ success: false, error: "Invalid request" }, { status: 400 });
  }

  try {
    await prisma.user.update({
      where: { id: chauffeurId },
      data: { chauffeurApprovalStatus: status },
    });

    return json({ success: true });
  } catch (error) {
    console.error("Error updating chauffeur approval status:", error);
    return json({ success: false, error: "Failed to update status" }, { status: 500 });
  }
}

const statusColors: Record<ChauffeurApprovalStatus, string> = {
  PENDING: "bg-yellow-50 ring-yellow-600/10 text-yellow-600",
  APPROVED: "bg-green-50 ring-green-600/10 text-green-600",
  REJECTED: "bg-red-50 ring-red-600/10 text-red-600",
};

const chauffeurApprovalStatusOptions: Record<ChauffeurApprovalStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

const chauffeurApprovalStatusColors: Record<ChauffeurApprovalStatus, string> = {
  PENDING: "bg-yellow-50 ring-yellow-600/10 text-yellow-600",
  APPROVED: "bg-green-50 ring-green-600/10 text-green-600",
  REJECTED: "bg-red-50 ring-red-600/10 text-red-600",
};

// const approvalStatusOptions = {
//   PENDING: "Pending",
//   APPROVED: "Approved",
//   REJECTED: "Rejected",
// };

const chauffeurStatusColors: Record<ChauffeurStatus, string> = {
  ON_TRIP: "bg-blue-50 ring-blue-600/10 text-blue-600",
  AVAILABLE: "bg-green-50 ring-green-600/10 text-green-600",
  ASSIGNED: "bg-yellow-50 ring-yellow-600/10 text-yellow-600",
};

const chauffeurStatusOptions: Record<ChauffeurStatus, string> = {
  ON_TRIP: "On Trip",
  AVAILABLE: "Available",
  ASSIGNED: "Assigned",
};

const columnHelper = createColumnHelper<User>();

const columns = [
  columnHelper.accessor("name", {
    header: ({ column }) => <ColumnHeader column={column} title="Name" />,
    cell: ({ row }) => (
      <Link
        to={`/admin/owners/${row.original.fleetOwnerId}/chauffeurs/${row.original.id}`}
        className="hover:text-blue-600"
      >
        <div className="flex flex-col">
          <span>{row.original.name}</span>
          <span className="text-sm text-gray-500">{row.original.email}</span>
        </div>
      </Link>
    ),
  }),
  columnHelper.accessor("phoneNumber", {
    header: ({ column }) => <ColumnHeader column={column} title="Phone Number" />,
    enableColumnFilter: false,
  }),
  columnHelper.accessor(
    (row) => {
      const booking = row.bookingsAsChauffeur?.[0];
      if (booking?.status === "ACTIVE") return "ON_TRIP";
      if (booking?.status === "CONFIRMED") return "ASSIGNED";
      return "AVAILABLE";
    },
    {
      id: "status",
      header: ({ column }) => <ColumnHeader column={column} title="Status" />,
      cell: ({ getValue }) => {
        const status = getValue();
        return (
          <Badge variant="outline" className={chauffeurStatusColors[status]}>
            {chauffeurStatusOptions[status]}
          </Badge>
        );
      },
    },
  ),
  columnHelper.accessor("createdAt", {
    header: ({ column }) => <ColumnHeader column={column} title="Joined Date" />,
    cell: (info) => new Date(info.getValue()).toLocaleDateString(),
    enableColumnFilter: false,
  }),
  columnHelper.accessor("chauffeurApprovalStatus", {
    header: ({ column }) => <ColumnHeader column={column} title="Approval Status" />,
    cell: ({ row }) => {
      const status = row.original.chauffeurApprovalStatus ?? "PENDING";
      return (
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              chauffeurApprovalStatusColors[status],
              "rounded border-none ring-1 ring-inset",
            )}
          >
            {chauffeurApprovalStatusOptions[status]}
          </Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <Form method="post">
                <input type="hidden" name="chauffeurId" value={row.original.id} />
                <input type="hidden" name="intent" value="updateApprovalStatus" />
                {status !== "APPROVED" && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.preventDefault();
                      const form = e.currentTarget.closest("form");
                      if (form) {
                        const input = document.createElement("input");
                        input.type = "hidden";
                        input.name = "status";
                        input.value = "APPROVED";
                        form.appendChild(input);
                        form.submit();
                      }
                    }}
                    className="text-green-600"
                  >
                    Approve
                  </DropdownMenuItem>
                )}
                {status !== "REJECTED" && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.preventDefault();
                      const form = e.currentTarget.closest("form");
                      if (form) {
                        const input = document.createElement("input");
                        input.type = "hidden";
                        input.name = "status";
                        input.value = "REJECTED";
                        form.appendChild(input);
                        form.submit();
                      }
                    }}
                    className="text-red-600"
                  >
                    Reject
                  </DropdownMenuItem>
                )}
                {(status === "APPROVED" || status === "REJECTED") && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.preventDefault();
                      const form = e.currentTarget.closest("form");
                      if (form) {
                        const input = document.createElement("input");
                        input.type = "hidden";
                        input.name = "status";
                        input.value = "PENDING";
                        form.appendChild(input);
                        form.submit();
                      }
                    }}
                  >
                    Reset to Pending
                  </DropdownMenuItem>
                )}
              </Form>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
  }),
] as const;

export default function OwnerChauffeurs() {
  const { owner } = useLoaderData<typeof loader>();
  const { toast } = useToast();
  const navigation = useNavigation();
  const actionData = useActionData<typeof action>();

  useEffect(() => {
    if (navigation.state === "idle" && actionData) {
      if (actionData.success) {
        toast({
          title: "Success",
          description: "Chauffeur status updated successfully",
          variant: "default",
        });
      } else if (actionData.error) {
        toast({
          title: "Error",
          description: actionData.error,
          variant: "destructive",
        });
      }
    }
  }, [navigation.state, actionData, toast]);

  return (
    <div className="p-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold mb-2">{owner.name}'s Chauffeurs</h1>
          <p className="text-gray-600">{owner.email}</p>
        </div>
      </div>

      <Table
        columns={columns}
        data={owner.chauffeurs}
        initialSorting={[
          {
            id: "name",
            desc: false,
          },
        ]}
      />
    </div>
  );
}
