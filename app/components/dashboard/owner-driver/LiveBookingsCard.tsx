import { Activity } from "lucide-react";
import { Link } from "@remix-run/react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import type { BookingWithRelations } from "~/types";
import { UnifiedBookingItem } from "./UnifiedBookingItem";

interface LiveBookingsCardProps {
  readonly bookings: BookingWithRelations[];
}

export function LiveBookingsCard({ bookings }: LiveBookingsCardProps) {
  return (
    <Card className="border-none shadow-none h-full flex flex-col">
      <CardHeader className="p-4 px-0">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <CardTitle className="text-blue-900 dark:text-blue-100 text-base">Live</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col flex-1 space-y-4 px-0 pb-0">
        {bookings.length === 0 ? (
          <div className="shadow-sm rounded-sm border p-4 space-y-3 bg-gradient-to-t from-primary/5 to-card shadow-xs dark:bg-card w-full min-w-0 flex-1 flex flex-col items-center justify-center text-center">
            <div className="rounded-full bg-muted p-3 mb-2">
              <Activity className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold mb-1">No Active Bookings</h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-3">
              You don't have any bookings in progress at the moment. Check back later for updates.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link to="/fleet-owner/bookings">View All Bookings</Link>
            </Button>
          </div>
        ) : (
          bookings.map((booking) => (
            <UnifiedBookingItem key={booking.id} booking={booking} statusType="live" />
          ))
        )}
      </CardContent>
    </Card>
  );
}
