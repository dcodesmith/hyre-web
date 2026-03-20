import { AlertCircle, ArrowRight } from "lucide-react";
import { Link } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import type { BookingWithRelations } from "~/types";
import { UnifiedBookingItem } from "../shared";

interface PendingApprovalCardProps {
  readonly bookings: BookingWithRelations[];
}

export function PendingApprovalCard({ bookings }: PendingApprovalCardProps) {
  const oldestBooking = bookings[0];
  const hasMultipleBookings = bookings.length > 1;

  return (
    <Card className="border-none shadow-none h-full flex flex-col">
      <CardHeader className="p-4 px-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            <CardTitle className="text-orange-900 dark:text-orange-100 text-base">
              Action Required
            </CardTitle>
          </div>
          {hasMultipleBookings && (
            <Link className="flex items-center gap-1" to="/fleet-owner/bookings">
              View All
              <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col flex-1 space-y-4 px-0 pb-0">
        {bookings.length === 0 ? (
          <div className="shadow-sm rounded-sm border p-4 space-y-3 bg-gradient-to-t from-primary/5 to-card shadow-xs dark:bg-card w-full min-w-0 flex-1 flex flex-col items-center justify-center text-center">
            <div className="rounded-full bg-muted p-3 mb-2">
              <AlertCircle className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold mb-1">All Clear</h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-3">
              No bookings require your attention right now. Everything is up to date.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link to="/fleet-owner/bookings">View All Bookings</Link>
            </Button>
          </div>
        ) : (
          <UnifiedBookingItem
            key={oldestBooking.id}
            booking={oldestBooking}
            statusType="action-required"
          />
        )}
      </CardContent>
    </Card>
  );
}
