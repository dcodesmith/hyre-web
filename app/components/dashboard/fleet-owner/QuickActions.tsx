import { Link } from "@remix-run/react";
import { Car, Users, Calendar, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";

interface QuickActionsProps {
  readonly unassignedBookingsCount: number;
  readonly availableChauffeursCount: number;
}

export function QuickActions({
  unassignedBookingsCount,
  availableChauffeursCount,
}: QuickActionsProps) {
  const actions = [
    {
      icon: <Car className="size-5" />,
      label: "Manage Fleet",
      description: "View and manage your vehicles",
      href: "/fleet-owner/cars",
      variant: "secondary" as const,
    },
    {
      icon: <Users className="size-5" />,
      label: "Manage Chauffeurs",
      description: "View and assign chauffeurs",
      href: "/fleet-owner/chauffeurs",
      variant: "secondary" as const,
    },
    {
      icon: <Calendar className="size-5" />,
      label: "All Bookings",
      description: "View booking history",
      href: "/fleet-owner/bookings",
      variant: "secondary" as const,
    },
  ];

  return (
    <Card className="@container/card to-card shadow-md dark:bg-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg font-semibold">Quick Actions</CardTitle>
        {unassignedBookingsCount > 0 && (
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="size-3" />
            {unassignedBookingsCount} unassigned
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {actions.map((action) => (
            <Button
              key={action.href}
              variant={action.variant}
              className="h-auto flex-col items-start p-4 text-left"
              asChild
            >
              <Link to={action.href}>
                <div className="flex items-center gap-2 mb-2">
                  {action.icon}
                  <span className="font-semibold">{action.label}</span>
                </div>
                <p className="text-xs text-muted-foreground font-normal">{action.description}</p>
              </Link>
            </Button>
          ))}
        </div>

        {unassignedBookingsCount > 0 && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium">Attention Required</p>
                <p className="text-xs text-muted-foreground">
                  {unassignedBookingsCount} booking{unassignedBookingsCount === 1 ? "" : "s"} need
                  chauffeur assignment
                  {availableChauffeursCount > 0 && (
                    <span className="text-green-600 dark:text-green-400">
                      {" "}
                      • {availableChauffeursCount} chauffeur
                      {availableChauffeursCount === 1 ? "" : "s"} available
                    </span>
                  )}
                </p>
              </div>
              <Button size="sm" asChild>
                <Link to="#unassigned-bookings">Assign Now</Link>
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
