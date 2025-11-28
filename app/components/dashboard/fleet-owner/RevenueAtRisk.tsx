import { AlertTriangle, Clock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { formatCurrency } from "~/lib/utils";
import { differenceInHours } from "date-fns";

interface UnassignedBooking {
  readonly id: string;
  readonly startDate: Date;
  readonly totalAmount: number;
}

interface RevenueAtRiskProps {
  readonly unassignedBookings: UnassignedBooking[];
}

export function RevenueAtRisk({ unassignedBookings }: RevenueAtRiskProps) {
  const totalValue = unassignedBookings.reduce((sum, booking) => sum + booking.totalAmount, 0);
  const now = new Date();

  // Count bookings starting within 24 hours
  const urgentBookings = unassignedBookings.filter(
    (booking) => differenceInHours(new Date(booking.startDate), now) <= 24,
  );

  if (unassignedBookings.length === 0) {
    return null;
  }

  return (
    <Card className="@container/card border-orange-200 bg-gradient-to-t from-orange-50/50 to-card shadow-sm dark:border-orange-900/50 dark:from-orange-950/20">
      <CardHeader className="relative">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardDescription className="text-orange-700 dark:text-orange-400">
              Revenue at Risk
            </CardDescription>
            <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums text-orange-900 dark:text-orange-100">
              {formatCurrency(totalValue)}
            </CardTitle>
          </div>
          <div className="rounded-full bg-orange-100 p-2 dark:bg-orange-900/50">
            <AlertTriangle className="size-5 text-orange-600 dark:text-orange-400" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-neutral-600 dark:text-neutral-400">
            {unassignedBookings.length} booking{unassignedBookings.length === 1 ? "" : "s"} awaiting
            chauffeur assignment
          </span>
        </div>

        {urgentBookings.length > 0 && (
          <div className="flex items-center gap-2 rounded-md bg-orange-100 px-3 py-2 dark:bg-orange-900/30">
            <Clock className="size-4 text-orange-600 dark:text-orange-400" />
            <span className="text-sm font-medium text-orange-900 dark:text-orange-100">
              {urgentBookings.length} starting within 24 hours
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
