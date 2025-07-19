import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import { z } from "zod";
import { parseWithZod } from "@conform-to/zod";
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
import { useState } from "react";
import { Table } from "~/components/Table/Table";
import { createColumnHelper } from "@tanstack/react-table";
import { ColumnHeader } from "~/components/Table/ColumnHeader";
import { Badge } from "~/components/ui/badge";
import { useToast } from "~/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

const staffSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phoneNumber: z.string().min(10, "Phone number must be at least 10 digits"),
});

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireAdminWithRedirect(request);

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

  for (const [id, user] of allPotentialStaff) {
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

  return json({ allStaff });
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireAdminWithRedirect(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "revoke" || intent === "reinstate") {
    const staffId = formData.get("staffId");
    if (typeof staffId !== "string") {
      return json({ success: false, error: "Invalid staff ID" }, { status: 400 });
    }

    try {
      if (intent === "revoke") {
        // Remove the staff role from the user
        await prisma.user.update({
          where: { id: staffId },
          data: {
            roles: {
              disconnect: [{ name: "staff" }],
            },
          },
        });
      } else {
        // Reinstate the staff role
        await prisma.user.update({
          where: { id: staffId },
          data: {
            roles: {
              connect: [{ name: "staff" }],
            },
          },
        });
      }

      return json({ success: true });
    } catch (error) {
      console.error(`Error ${intent}ing staff access:`, error);
      return json({ success: false, error: `Failed to ${intent} staff access` }, { status: 500 });
    }
  }

  // Handle staff creation
  const submission = parseWithZod(formData, { schema: staffSchema });

  if (submission.status !== "success") {
    return json(submission.reply());
  }

  try {
    // Create the user with staff role
    const newUser = await prisma.user.create({
      data: {
        ...submission.value,
        roles: {
          connect: [{ name: "staff" }],
        },
      },
    });

    return json({ success: true, user: newUser });
  } catch (error) {
    console.error("Error creating staff member:", error);
    return json({ success: false, error: "Failed to create staff member" }, { status: 500 });
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

function StaffTable({
  data,
  hideColumnViewOptions,
}: {
  data: StaffMember[];
  hideColumnViewOptions: boolean;
}) {
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
      cell: (info) => (
        <Badge variant={info.getValue() === "active" ? "default" : "secondary"}>
          {info.getValue() === "active" ? "Active" : "Revoked"}
        </Badge>
      ),
    }),
    columnHelper.accessor("createdAt", {
      header: ({ column }) => <ColumnHeader column={column} title="Added On" />,
      cell: (info) => new Date(info.getValue()).toLocaleDateString(),
      enableColumnFilter: false,
    }),
    columnHelper.accessor("id", {
      enableColumnFilter: false,
      header: "Actions",
      cell: ({ row }) => {
        const actionFetcher = useFetcher();
        const isProcessing = actionFetcher.state === "submitting";
        const isActive = row.original.status === "active";
        const intent = isActive ? "revoke" : "reinstate";
        const buttonText = isActive ? "Revoke Access" : "Reinstate Access";
        const buttonVariant = isActive ? "destructive" : "default";

        const handleAction = () => {
          if (window.confirm(`Are you sure you want to ${intent} this staff member's access?`)) {
            actionFetcher.submit({ intent, staffId: row.original.id }, { method: "post" });
          }
        };

        return (
          <Button variant={buttonVariant} size="sm" onClick={handleAction} disabled={isProcessing}>
            {isProcessing
              ? `${intent === "revoke" ? "Revoking..." : "Reinstating..."}`
              : buttonText}
          </Button>
        );
      },
    }),
  ];

  return <Table columns={columns} data={data} hideColumnViewOptions />;
}

export default function AdminStaffPage() {
  const { allStaff } = useLoaderData<typeof loader>();
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const fetcher = useFetcher();
  const { toast } = useToast();

  const [form, { name, email, phoneNumber }] = useForm({
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: staffSchema });
    },
    shouldValidate: "onInput",
  });

  const isSubmitting = fetcher.state === "submitting";

  const activeStaffCount = allStaff.filter((staff) => staff.status === "active").length;
  const revokedStaffCount = allStaff.filter((staff) => staff.status === "revoked").length;

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

          <fetcher.Form method="post" className="space-y-4" {...getFormProps(form)}>
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
              <Button type="button" variant="outline" onClick={() => setIsAddStaffOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Adding..." : "Add Staff"}
              </Button>
            </DialogFooter>
          </fetcher.Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
