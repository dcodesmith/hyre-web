import { Link } from "@remix-run/react";
import { differenceInHours, differenceInMinutes, format } from "date-fns";
import { CheckCircle2, Clock, DollarSign, ExternalLink, MapPin, Phone, User } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { formatCurrency } from "~/lib/utils";
import type { BookingWithRelations } from "~/types";

interface NowCardProps {
  readonly booking?: BookingWithRelations;
  readonly todayEarnings: number;
}

function EmptyNowCard() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <div className="rounded-full bg-primary/10 p-3 mb-4">
          <CheckCircle2 className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Your Car is Ready</h3>
        <p className="text-sm text-muted-foreground max-w-sm mb-4">
          No bookings scheduled right now. Your vehicle is available and ready for new reservations.
        </p>
        <Button asChild variant="outline">
          <Link to="/fleet-owner/bookings">Check Upcoming Bookings</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function getTimeRemaining(endDate: Date): string {
  const now = new Date();
  if (endDate <= now) {
    return "Ending soon";
  }

  const hours = differenceInHours(endDate, now);
  const minutes = differenceInMinutes(endDate, now) % 60;

  if (hours < 1) {
    return `${minutes}min`;
  }
  return `${hours}h ${minutes}min`;
}

export function NowCard({ booking, todayEarnings }: NowCardProps) {
  if (!booking) {
    return <EmptyNowCard />;
  }

  const isActive = booking.status === "ACTIVE";
  const timeRemaining = getTimeRemaining(new Date(booking.endDate));

  // Handle guestUser as JSON field
  const guestUser = booking.guestUser as { email?: string; phoneNumber?: string } | null;
  const customerName = booking.user?.name || guestUser?.email || "Customer";
  const customerPhone = booking.user?.phoneNumber || guestUser?.phoneNumber;

  return (
    <Card className="border-blue-200 bg-gradient-to-br from-blue-50/50 to-white dark:from-blue-950/20 dark:to-background">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
            Right Now
          </CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link to={`/fleet-owner/bookings/${booking.id}`}>
              <span className="sr-only">View details</span>
              <ExternalLink className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Status Badge */}
        <div className="flex items-center gap-2">
          <Badge variant={isActive ? "default" : "secondary"} className="text-sm">
            {isActive ? "Active Booking" : "Next Booking"}
          </Badge>
          <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
            {isActive
              ? `Ends in ${timeRemaining}`
              : `Starts ${format(new Date(booking.startDate), "MMM d, h:mm a")}`}
          </span>
        </div>

        {/* Customer Info */}
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="rounded-full bg-primary/10 p-2 shrink-0">
                <User className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-lg truncate">{customerName}</p>
                <p className="text-xs text-muted-foreground">Customer</p>
              </div>
            </div>

            {customerPhone && (
              <Button asChild size="sm" className="shrink-0">
                <a href={`tel:${customerPhone}`}>
                  <Phone className="h-4 w-4 mr-1" />
                  Call
                </a>
              </Button>
            )}
          </div>

          {/* Route */}
          <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3">
            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0 text-sm">
              <p className="font-medium truncate">{booking.pickupLocation}</p>
              <div className="flex items-center gap-1 text-muted-foreground my-1">
                <div className="h-4 border-l-2 border-dashed border-muted-foreground/30 ml-0.5" />
              </div>
              <p className="font-medium truncate">{booking.returnLocation}</p>
            </div>
          </div>

          {/* Time Details */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>
              {format(new Date(booking.startDate), "MMM d, h:mm a")} -{" "}
              {format(new Date(booking.endDate), "MMM d, h:mm a")}
            </span>
          </div>
        </div>

        {/* Booking Reference */}
        <div className="pt-3 border-t">
          <p className="text-xs text-muted-foreground">
            Ref: <span className="font-mono">{booking.bookingReference}</span>
          </p>
        </div>

        {/* Today's Earnings */}
        <div className="rounded-lg bg-green-50 dark:bg-green-950/20 p-4 border border-green-200 dark:border-green-900">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-green-700 dark:text-green-400 uppercase tracking-wide mb-1">
                Today's Earnings
              </p>
              <p className="text-2xl md:text-3xl font-bold text-green-900 dark:text-green-50">
                {formatCurrency(todayEarnings)}
              </p>
            </div>
            <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-3">
              <DollarSign className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
