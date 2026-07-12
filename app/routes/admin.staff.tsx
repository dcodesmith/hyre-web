import {
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
  data,
  useLoaderData,
  useFetcher,
} from "react-router";
import { parseWithZod } from "@conform-to/zod/v4";
import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { requireAdminWithRedirect } from "~/modules/auth/auth.server";
import { prisma } from "~/modules/db/db.server";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { useState, useEffect, useRef } from "react";
import { LazyTable } from "~/components/Table/LazyTable";
import { createColumnHelper, type Row } from "@tanstack/react-table";
import { ColumnHeader } from "~/components/Table/ColumnHeader";
import { Badge } from "~/components/ui/badge";
import { useAuthenticityToken } from "remix-utils/csrf/react";
import { validateCSRF } from "~/utils/csrf-action.server";
import { Prisma } from "@prisma/client";
import logger from "~/lib/logger.server";
import { staffSchema } from "~/schemas/admin.schema";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdminWithRedirect(request);

  // Get all users who currently have staff role
  const currentStaff = await prisma.user.findMany({
    where: {
      roles: {
        some: {
          name: "staff",
        },
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      phoneNumber: true,
      createdAt: true,
      roles: {
        select: { name: true },
      },
    },
  });

  // Get all users with approval history (potential revoked staff)
  const usersWithApprovalHistory = await prisma.user.findMany({
    where: {
      OR: [{ approvedDocuments: { some: {} } }, { approvedVehicleImages: { some: {} } }],
    },
    select: {
      id: true,
      name: true,
      email: true,
      phoneNumber: true,
      createdAt: true,
      roles: {
        select: { name: true },
      },
    },
  });

  // Also get all users who were created through the staff creation form
  // These would be users with email patterns or specific creation methods
  // For now, we'll include any user who has the staff creation pattern
  // Note: This is a workaround since we don't track role history
  const potentialStaffUsers = await prisma.user.findMany({
    where: {
      AND: [
        {
          roles: {
            none: {
              name: "admin",
            },
          },
        },
        {
          roles: {
            none: {
              name: "fleetOwner",
            },
          },
        },
        {
          roles: {
            none: {
              name: "user",
            },
          },
        },
        {
          roles: {
            none: {
              name: "chauffeur",
            },
          },
        },
        // Users with no roles left are likely revoked staff
        {
          NOT: {
            roles: {
              some: {},
            },
          },
        },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      phoneNumber: true,
      createdAt: true,
      roles: {
        select: { name: true },
      },
    },
  });

  // Combine all potential staff users and deduplicate
  const allPotentialStaff = new Map();

  // Add current staff
  for (const staff of currentStaff) {
    allPotentialStaff.set(staff.id, { ...staff, isCurrentStaff: true });
  }

  // Add users with approval history
  for (const user of usersWithApprovalHistory) {
    if (!allPotentialStaff.has(user.id)) {
      allPotentialStaff.set(user.id, { ...user, isCurrentStaff: false });
    }
  }

  // Add users with no roles (likely revoked staff)
  for (const user of potentialStaffUsers) {
    if (!allPotentialStaff.has(user.id)) {
      allPotentialStaff.set(user.id, { ...user, isCurrentStaff: false });
    }
  }

  // Separate active and revoked staff
  const activeStaff: StaffMember[] = [];
  const revokedStaff: StaffMember[] = [];

  for (const user of allPotentialStaff.values()) {
    const hasStaffRole = user.roles.some((role: any) => role.name === "staff");
    const isAdmin = user.roles.some((role: any) => role.name === "admin");

    if (hasStaffRole) {
      activeStaff.push({
        id: user.id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        createdAt: user.createdAt.toISOString(),
        status: "active",
      });
    } else if (!isAdmin) {
      // Consider as revoked staff if not admin
      revokedStaff.push({
        id: user.id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        createdAt: user.createdAt.toISOString(),
        status: "revoked",
      });
    }
  }

  // Combine all staff
  const allStaff = [...activeStaff, ...revokedStaff].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return { allStaff };
}

export async function action({ request }: ActionFunctionArgs) {
  await validateCSRF(request);
  await requireAdminWithRedirect(request);

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "revoke" || intent === "reinstate") {
    const staffId = formData.get("staffId");

    if (typeof staffId !== "string") {
      return data({ success: false, error: "Invalid staff ID" }, { status: 400 });
    }

    try {
      await prisma.user.update({
        where: { id: staffId },
        data: {
          roles:
            intent === "revoke"
              ? { disconnect: [{ name: "staff" }] }
              : { connect: [{ name: "staff" }] },
        },
      });

      return { success: true };
    } catch (error) {
      logger.error(`Error ${intent}ing staff access:`, error);
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        return data({ success: false, error: "User not found" }, { status: 404 });
      }
      return data({ success: false, error: `Failed to ${intent} staff access` }, { status: 500 });
    }
  }

  // Handle staff creation
  const submission = parseWithZod(formData, { schema: staffSchema });

  if (submission.status !== "success") {
    return data(submission.reply(), { status: 400 });
  }

  try {
    // Create the user with staff role
    await prisma.user.create({
      data: {
        ...submission.value,
        roles: {
          connect: [{ name: "staff" }],
        },
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Error creating staff member:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return data({ success: false, error: "Email already exists" }, { status: 409 });
    }
    return data({ success: false, error: "Failed to create staff member" }, { status: 500 });
  }
}

type StaffMember = {
  id: string;
  name: string | null;
  email: string;
  phoneNumber: string | null;
  createdAt: string;
  status: "active" | "revoked";
};

type ActionResponse = {
  success: boolean;
  error?: string;
  user?: any;
};

const columnHelper = createColumnHelper<StaffMember>();

const columns = [
  columnHelper.accessor("name", {
    header: ({ column }) => <ColumnHeader column={column} title="Name" />,
    cell: (info) => info.getValue() || "N/A",
    enableColumnFilter: false,
  }),
  columnHelper.accessor("email", {
    header: ({ column }) => <ColumnHeader column={column} title="Email" />,
    enableColumnFilter: false,
  }),
  columnHelper.accessor("phoneNumber", {
    header: ({ column }) => <ColumnHeader column={column} title="Phone" />,
    cell: (info) => info.getValue() || "N/A",
    enableColumnFilter: false,
  }),
  columnHelper.accessor("status", {
    header: ({ column }) => <ColumnHeader column={column} title="Status" />,
    cell: (info) => {
      const status = info.getValue();
      return (
        <Badge variant={status === "active" ? "default" : "secondary"}>
          {status === "active" ? "Active" : "Revoked"}
        </Badge>
      );
    },
  }),
  columnHelper.accessor("createdAt", {
    header: ({ column }) => <ColumnHeader column={column} title="Added On" />,
    cell: (info) => new Date(info.getValue()).toLocaleDateString(),
    enableColumnFilter: false,
  }),
  columnHelper.accessor("id", {
    enableColumnFilter: false,
    header: "Actions",
    cell: ({ row }) => <StaffActions row={row} />,
  }),
];

function StaffActions({ row }: { readonly row: Row<StaffMember> }) {
  const actionFetcher = useFetcher();
  const csrf = useAuthenticityToken();
  const isProcessing = actionFetcher.state === "submitting";
  const isActive = row.original.status === "active";
  const intent = isActive ? "revoke" : "reinstate";
  const buttonText = isActive ? "Revoke Access" : "Reinstate Access";
  const buttonVariant = isActive ? "destructive" : "default";
  const staffId = row.original.id;

  const handleAction = () => {
    if (window.confirm(`Are you sure you want to ${intent} this staff member's access?`)) {
      actionFetcher.submit({ intent, staffId, csrf }, { method: "post" });
    }
  };

  return (
    <Button variant={buttonVariant} size="sm" onClick={handleAction} disabled={isProcessing}>
      {isProcessing ? `${intent === "revoke" ? "Revoking..." : "Reinstating..."}` : buttonText}
    </Button>
  );
}

function StaffTable({
  data,
  hideColumnViewOptions,
}: {
  readonly data: StaffMember[];
  readonly hideColumnViewOptions: boolean;
}) {
  return <LazyTable columns={columns} data={data} hideColumnViewOptions={hideColumnViewOptions} />;
}

export default function AdminStaffPage() {
  const { allStaff } = useLoaderData<typeof loader>();
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const fetcher = useFetcher();
  const formRef = useRef<HTMLFormElement>(null);
  const csrfToken = useAuthenticityToken();

  const [form, { name, email, phoneNumber }] = useForm({
    lastResult: fetcher.data as any,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: staffSchema });
    },
    shouldValidate: "onBlur",
  });

  const isPending = fetcher.state === "submitting";

  useEffect(() => {
    const data = fetcher.data as ActionResponse;
    if (data?.success && fetcher.state === "idle") {
      setIsAddStaffOpen(false);
    }
  }, [fetcher.data, fetcher.state]);

  const { activeStaffCount, revokedStaffCount } = allStaff.reduce(
    (acc, staff) => ({
      activeStaffCount: acc.activeStaffCount + (staff.status === "active" ? 1 : 0),
      revokedStaffCount: acc.revokedStaffCount + (staff.status === "revoked" ? 1 : 0),
    }),
    { activeStaffCount: 0, revokedStaffCount: 0 },
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Staff Management</h1>
          <p className="text-sm text-muted-foreground">
            {activeStaffCount} active, {revokedStaffCount} revoked
          </p>
        </div>
        <Button onClick={() => setIsAddStaffOpen(true)}>Add Staff</Button>
      </div>

      <StaffTable data={allStaff} hideColumnViewOptions />

      <Dialog open={isAddStaffOpen} onOpenChange={setIsAddStaffOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add Staff Member</DialogTitle>
            <DialogDescription>
              Create a new staff member who can handle approvals.
            </DialogDescription>
          </DialogHeader>

          <fetcher.Form ref={formRef} method="post" className="space-y-4" {...getFormProps(form)}>
            <input type="hidden" name="csrf" value={csrfToken} />
            <div className="space-y-1">
              <Label htmlFor={name.id}>Full Name</Label>
              <Input
                {...getInputProps(name, { type: "text" })}
                placeholder="John Doe"
                className={name.errors ? "border-destructive" : ""}
              />
              {name.errors && (
                <div className="text-destructive text-sm">{name.errors.join(", ")}</div>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor={email.id}>Email</Label>
              <Input
                {...getInputProps(email, { type: "email" })}
                placeholder="email@example.com"
                className={email.errors ? "border-destructive" : ""}
              />
              {email.errors && (
                <div className="text-destructive text-sm">{email.errors.join(", ")}</div>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor={phoneNumber.id}>Phone Number</Label>
              <Input
                {...getInputProps(phoneNumber, { type: "tel" })}
                placeholder="+1234567890"
                className={phoneNumber.errors ? "border-destructive" : ""}
              />
              {phoneNumber.errors && (
                <div className="text-destructive text-sm">{phoneNumber.errors.join(", ")}</div>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsAddStaffOpen(false);
                  form.reset();
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Adding..." : "Add Staff"}
              </Button>
            </DialogFooter>
          </fetcher.Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
