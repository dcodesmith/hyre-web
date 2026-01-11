import { Link } from "@remix-run/react";
import { Calendar, Car, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { formatCurrency, formatDate } from "~/lib/utils";

interface UnassignedBooking {
  readonly id: string;
  readonly startDate: Date;
  readonly endDate: Date;
  readonly status: string;
  readonly paymentStatus: string;
  readonly netTotal: number | null;
  readonly fleetOwnerPayoutAmountNet: number | null;
  readonly car: {
    readonly make: string;
    readonly model: string;
    readonly registrationNumber: string;
  };
  readonly user: {
    readonly name: string | null;
    readonly email: string;
  } | null;
}

interface UnassignedBookingsTableProps {
  readonly bookings: UnassignedBooking[];
}

export function UnassignedBookingsTable({ bookings }: UnassignedBookingsTableProps) {
  if (bookings.length === 0) {
    return (
      <Card className="@container/card bg-gradient-to-t from-primary/5 to-card shadow-md dark:bg-card">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Unassigned Bookings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="size-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No unassigned bookings at the moment</p>
            <p className="text-xs mt-1">All confirmed bookings have chauffeurs assigned</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      id="unassigned-bookings"
      className="@container/card bg-gradient-to-t from-primary/5 to-card shadow-md dark:bg-card"
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold">Unassigned Bookings</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {bookings.length} booking{bookings.length === 1 ? "" : "s"} waiting for chauffeur
              assignment
            </p>
          </div>
          <Badge variant="destructive">{bookings.length}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {bookings.map((booking) => (
            <div
              key={booking.id}
              className="rounded-lg border bg-card p-4 hover:bg-accent/50 transition-colors"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Car & Customer Info */}
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <Car className="size-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">
                        {booking.car.make} {booking.car.model}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {booking.car.registrationNumber}
                      </p>
                    </div>
                  </div>
                  {booking.user && (
                    <div className="flex items-start gap-2">
                      <User className="size-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-xs font-medium">{booking.user.name || "Guest"}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {booking.user.email}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Dates */}
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <Calendar className="size-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground">Start Date</p>
                      <p className="text-sm font-medium">{formatDate(booking.startDate)}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Calendar className="size-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground">End Date</p>
                      <p className="text-sm font-medium">{formatDate(booking.endDate)}</p>
                    </div>
                  </div>
                </div>

                {/* Payment Info */}
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <p className="text-xs text-muted-foreground">Your Payout</p>
                    <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                      {formatCurrency(booking.fleetOwnerPayoutAmountNet ?? 0)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="text-xs">
                      {booking.status}
                    </Badge>
                    <Badge
                      variant={booking.paymentStatus === "PAID" ? "secondary" : "outline"}
                      className="text-xs"
                    >
                      {booking.paymentStatus}
                    </Badge>
                  </div>
                </div>

                {/* Action */}
                <div className="flex items-center justify-end">
                  <Button className="w-full sm:w-auto" size="sm" asChild>
                    <Link
                      to={`/fleet-owner/bookings/${booking.id}?startDate=${encodeURIComponent(
                        booking.startDate.toISOString(),
                      )}`}
                    >
                      Assign Chauffeur
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
