import { Calendar, MapPin, User, ArrowRight, Clock } from "lucide-react";
import { Link } from "@remix-run/react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { formatCurrency } from "~/lib/utils";
import type { BookingWithRelations } from "~/types";
import { format, isToday, isTomorrow, differenceInDays, startOfDay, endOfDay } from "date-fns";

interface UpcomingTimelineProps {
  readonly bookings: readonly BookingWithRelations[];
}

function AvailableGap({
  startDate,
  endDate,
}: { readonly startDate: Date; readonly endDate: Date }) {
  const days = differenceInDays(endDate, startDate);
  const dateText =
    days === 0
      ? format(startDate, "MMM d")
      : `${format(startDate, "MMM d")} - ${format(endDate, "MMM d")}`;

  return (
    <div className="relative flex items-center gap-4 py-3">
      <div className="flex flex-col items-center">
        <div className="h-3 w-3 rounded-full border-2 border-dashed border-muted-foreground/30 bg-background" />
      </div>

      <div className="flex-1 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 p-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span className="font-medium">Available: {dateText}</span>
        </div>
      </div>
    </div>
  );
}

function BookingItem({ booking }: { readonly booking: BookingWithRelations }) {
  const startDate = new Date(booking.startDate);
  const endDate = new Date(booking.endDate);

  // Handle guestUser as JSON field
  const guestUser = booking.guestUser as { email?: string; phoneNumber?: string } | null;
  const customerName = booking.user?.name || guestUser?.email || "Customer";

  let dateLabel = format(startDate, "EEE, MMM d");
  if (isToday(startDate)) {
    dateLabel = "Today";
  } else if (isTomorrow(startDate)) {
    dateLabel = "Tomorrow";
  }

  const timeLabel = `${format(startDate, "h:mm a")} - ${format(endDate, "h:mm a")}`;
  const isUrgent = differenceInDays(startDate, new Date()) < 1;

  return (
    <div className="relative flex items-start gap-4">
      <div className="flex flex-col items-center pt-2">
        <div
          className={`h-4 w-4 rounded-full border-2 ${isUrgent ? "border-orange-500 bg-orange-100 dark:bg-orange-950" : "border-blue-500 bg-blue-100 dark:bg-blue-950"}`}
        />
        <div className="w-0.5 h-full bg-border my-1" />
      </div>

      <Card
        className={`flex-1 mb-4 ${isUrgent ? "border-orange-200 dark:border-orange-900 bg-orange-50/50 dark:bg-orange-950/20" : ""}`}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div>
              <p className="font-semibold text-base">{dateLabel}</p>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                <Clock className="h-3.5 w-3.5" />
                <span>{timeLabel}</span>
              </div>
            </div>
            {isUrgent && (
              <Badge
                variant="outline"
                className="bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-800"
              >
                Soon
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2 mb-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium truncate">{customerName}</span>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
            <MapPin className="h-4 w-4 shrink-0" />
            <span className="truncate">{booking.pickupLocation}</span>
            <ArrowRight className="h-3 w-3 shrink-0" />
            <span className="truncate">{booking.returnLocation}</span>
          </div>

          <div className="flex items-center justify-between pt-3 border-t">
            <p className="text-base font-semibold text-green-700 dark:text-green-400">
              {formatCurrency(Number(booking.fleetOwnerPayoutAmountNet ?? booking.netTotal ?? 0))}
            </p>
            <Button asChild size="sm" variant="outline">
              <Link to={`/fleet-owner/bookings/${booking.id}`}>View Details</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function UpcomingTimeline({ bookings }: UpcomingTimelineProps) {
  if (bookings.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-full bg-muted p-3 mb-4">
            <Calendar className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Schedule is Clear</h3>
          <p className="text-sm text-muted-foreground max-w-sm mb-4">
            No bookings in the next 7 days. Your car is available for new reservations.
          </p>
          <Button asChild variant="outline">
            <Link to="/fleet-owner/bookings">View All Bookings</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Upcoming Bookings
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
        <div className="relative">
          {bookings.map((booking, index) => {
            // Check for gaps between bookings
            const prevBooking = index > 0 ? bookings[index - 1] : null;
            const hasGap =
              prevBooking &&
              differenceInDays(
                startOfDay(new Date(booking.startDate)),
                endOfDay(new Date(prevBooking.endDate)),
              ) > 1;

            return (
              <div key={booking.id}>
                {hasGap && prevBooking && (
                  <AvailableGap
                    startDate={endOfDay(new Date(prevBooking.endDate))}
                    endDate={startOfDay(new Date(booking.startDate))}
                  />
                )}
                <BookingItem booking={booking} />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
