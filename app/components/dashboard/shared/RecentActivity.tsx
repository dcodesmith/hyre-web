import { CheckCircle2, ArrowRight, Clock } from "lucide-react";
import { Link } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { formatCurrency } from "~/lib/utils";
import type { BookingWithRelations } from "~/types";
import { formatDistanceToNow, format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { LAGOS_TIMEZONE } from "~/utils/timezone";

interface RecentActivityProps {
  readonly bookings: BookingWithRelations[];
}

function ActivityItem({ booking }: { readonly booking: BookingWithRelations }) {
  const endDate = toZonedTime(new Date(booking.endDate), LAGOS_TIMEZONE);
  const timeAgo = formatDistanceToNow(endDate, { addSuffix: true });
  const dateLabel = format(endDate, "MMM d");

  // Create a short description
  const pickup = booking.pickupLocation?.split(",")[0] || "Pickup";
  const dropoff = booking.returnLocation?.split(",")[0] || "Dropoff";
  const description = `${pickup} → ${dropoff}`;

  return (
    <Link
      to={`/fleet-owner/bookings/${booking.id}`}
      className="block group hover:bg-muted/50 -mx-4 px-4 py-3 transition-colors rounded-lg"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-green-100 dark:bg-green-950 p-1.5 mt-0.5 shrink-0">
          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className="text-sm font-medium truncate">{description}</p>
            <span className="text-sm font-semibold text-green-700 dark:text-green-400 shrink-0">
              {formatCurrency(Number(booking.fleetOwnerPayoutAmountNet ?? booking.netTotal ?? 0))}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{dateLabel}</span>
            <span>•</span>
            <span suppressHydrationWarning>{timeAgo}</span>
          </div>
        </div>

        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
      </div>
    </Link>
  );
}

export function RecentActivity({ bookings }: RecentActivityProps) {
  if (bookings.length === 0) {
    return (
      <Card className="rounded-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <div className="rounded-full bg-muted p-3 w-fit mx-auto mb-3">
            <CheckCircle2 className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Complete your first booking to see your activity here.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link to="/fleet-owner/bookings">
              View All Bookings
              <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            Recent Activity
          </CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link to="/fleet-owner/bookings">
              View All
              <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-1">
          {bookings.map((booking) => (
            <ActivityItem key={booking.id} booking={booking} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
