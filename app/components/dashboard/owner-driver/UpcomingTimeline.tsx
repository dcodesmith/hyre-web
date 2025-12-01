import { Calendar, ArrowRight, Clock } from "lucide-react";
import { Link } from "@remix-run/react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import type { BookingWithRelations } from "~/types";
import { UnifiedBookingItem } from "./UnifiedBookingItem";
import { getTimeUntilBooking } from "~/lib/booking-utils";

interface UpcomingBookingsCardProps {
  readonly bookings: readonly BookingWithRelations[];
}

export function UpcomingBookingsCard({ bookings }: UpcomingBookingsCardProps) {
  const nextBooking = bookings[0];
  const timeUntilBooking = nextBooking ? getTimeUntilBooking(nextBooking) : null;

  return (
    <Card className="border-none shadow-none h-full flex flex-col">
      <CardHeader className="p-4 px-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            <CardTitle className="text-slate-900 dark:text-slate-100 text-base">Upcoming</CardTitle>
            {timeUntilBooking && (
              <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400">
                <Clock className="h-4 w-4" />
                <span className="font-medium">{timeUntilBooking}</span>
              </div>
            )}
          </div>
          <Link className="flex items-center gap-1" to="/fleet-owner/bookings">
            View All
            <ArrowRight className="h-4 w-4 ml-1" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col flex-1 space-y-4 px-0 pb-0">
        {nextBooking === undefined ? (
          <div className="shadow-sm rounded-sm border p-4 space-y-3 bg-gradient-to-t from-primary/5 to-card shadow-xs dark:bg-card w-full min-w-0 flex-1 flex flex-col items-center justify-center text-center">
            <div className="rounded-full bg-muted p-3 mb-2">
              <Calendar className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold mb-1">Schedule is Clear</h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-3">
              No bookings in the next 7 days. Your car is available for new reservations.
            </p>
            <Link className="flex items-center gap-1" to="/fleet-owner/bookings">
              View All
              <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </div>
        ) : (
          <UnifiedBookingItem key={nextBooking.id} booking={nextBooking} statusType="upcoming" />
        )}
      </CardContent>
    </Card>
  );
}
