import { type LoaderFunctionArgs, data } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { requireAdminOrStaffWithRedirect } from "~/modules/auth/auth.server";
import { prisma } from "~/modules/db/db.server";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

export async function loader({ request }: LoaderFunctionArgs) {
  const { user, isAdmin } = await requireAdminOrStaffWithRedirect(request);

  // Get dashboard statistics
  const [
    onboardedFleetOwners,
    totalFleetOwners,
    totalCars,
    totalBookings,
    pendingDocuments,
    approvedDocuments,
    totalDocuments,
  ] = await Promise.all([
    prisma.user.count({
      where: {
        roles: {
          some: {
            name: "fleetOwner",
          },
        },
        hasOnboarded: true,
      },
    }),
    prisma.user.count({
      where: {
        roles: {
          some: {
            name: "fleetOwner",
          },
        },
      },
    }),
    prisma.car.count(),
    prisma.booking.count(),
    prisma.documentApproval.count({
      where: {
        status: "PENDING",
      },
    }),
    prisma.documentApproval.count({
      where: {
        status: "APPROVED",
      },
    }),
    prisma.documentApproval.count(),
  ]);

  const response = {
    user,
    isAdmin,
    stats: {
      onboardedFleetOwners,
      totalFleetOwners,
      totalCars,
      totalBookings,
      pendingDocuments,
      approvedDocuments,
      totalDocuments,
    },
  };

  return data(response, {
    headers: { "Cache-Control": "no-store, private, must-revalidate", Vary: "Cookie" },
  });
}

export default function AdminDashboard() {
  const { user, isAdmin, stats } = useLoaderData<typeof loader>();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Welcome back, {user.name || user.email}</h1>
        <p className="text-muted-foreground">{isAdmin ? "Admin" : "Staff"} Dashboard</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fleet Owners</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.onboardedFleetOwners}/{stats.totalFleetOwners}
            </div>
            <p className="text-xs text-muted-foreground">Onboarded fleet owners</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cars</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCars}</div>
            <p className="text-xs text-muted-foreground">Registered vehicles</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalBookings}</div>
            <p className="text-xs text-muted-foreground">All time bookings</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.approvedDocuments}/{stats.totalDocuments}
            </div>
            <p className="text-xs text-muted-foreground">Approved documents</p>
          </CardContent>
        </Card>
      </div>

      {stats.pendingDocuments > 0 && (
        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Action Required</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                You have {stats.pendingDocuments} document(s) pending approval.{" "}
                <Link
                  to="/admin/documents"
                  className="text-primary hover:underline"
                  prefetch="intent"
                >
                  Review them now
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
