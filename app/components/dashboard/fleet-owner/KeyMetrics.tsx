import { Car, Users, Calendar, CalendarClock } from "lucide-react";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { formatCurrency } from "~/lib/utils";

interface KeyMetricsProps {
  readonly carCount: number;
  readonly availableCarsCount: number;
  readonly bookedCarsCount: number;
  readonly maintenanceCarsCount: number;
  readonly activeBookingsCount: number;
  readonly completedBookingsCount: number;
  readonly cancelledBookingsCount: number;
  readonly chauffeurCount: number;
  readonly availableChauffeursCount: number;
  readonly onDutyChauffeursCount: number;
  readonly monthlyRevenue: number;
  readonly todayStats: {
    readonly activeBookings: number;
    readonly confirmedBookings: number;
    readonly completedBookings: number;
    readonly cancelledBookings: number;
    readonly projectedRevenue: number;
  };
}

export function KeyMetrics({
  carCount,
  availableCarsCount,
  bookedCarsCount,
  maintenanceCarsCount,
  activeBookingsCount,
  completedBookingsCount,
  cancelledBookingsCount,
  chauffeurCount,
  availableChauffeursCount,
  onDutyChauffeursCount,
  monthlyRevenue,
  todayStats,
}: KeyMetricsProps) {
  // Calculate today's total bookings
  // We exclude cancelled bookings from the main display to show only productive activity
  const todayTotalBookings =
    todayStats.activeBookings + todayStats.confirmedBookings + todayStats.completedBookings;

  return (
    <div className="@xl/main:grid-cols-2 @3xl/main:grid-cols-4 grid grid-cols-1 gap-4">
      <Card className="@container/card bg-gradient-to-t from-primary/5 to-card shadow-sm dark:bg-card">
        <CardHeader className="relative">
          <CardDescription>Today's Activity</CardDescription>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
            {todayTotalBookings}
          </CardTitle>
          <div className="absolute right-4 top-4">
            <CalendarClock className="size-6 text-indigo-600 dark:text-indigo-400" />
          </div>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-2 text-sm">
          <div className="w-full space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-500 dark:text-neutral-400">Active</span>
              <span className="font-medium">{todayStats.activeBookings}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-500 dark:text-neutral-400">Starting Today</span>
              <span className="font-medium">{todayStats.confirmedBookings}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-500 dark:text-neutral-400">Completed</span>
              <span className="font-medium">{todayStats.completedBookings}</span>
            </div>
            {todayStats.cancelledBookings > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-500 dark:text-neutral-400">Cancelled</span>
                <span className="font-medium text-destructive">{todayStats.cancelledBookings}</span>
              </div>
            )}
          </div>
          {(todayStats.activeBookings > 0 || todayStats.completedBookings > 0) && (
            <div className="text-neutral-500 dark:text-neutral-400">
              Projected:{" "}
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                {formatCurrency(todayStats.projectedRevenue)}
              </span>
            </div>
          )}
        </CardFooter>
      </Card>

      <Card className="@container/card bg-gradient-to-t from-primary/5 to-card shadow-sm dark:bg-card">
        <CardHeader className="relative">
          <CardDescription>Fleet</CardDescription>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
            {carCount}
          </CardTitle>
          <div className="absolute right-4 top-4">
            <Car className="size-6 text-blue-600 dark:text-blue-400" />
          </div>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-2 text-sm">
          <div className="w-full space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-500 dark:text-neutral-400">Available Cars</span>
              <span className="font-medium">{availableCarsCount}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-500 dark:text-neutral-400">In Maintenance</span>
              <span className="font-medium">{maintenanceCarsCount}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-500 dark:text-neutral-400">Booked Cars</span>
              <span className="font-medium">{bookedCarsCount}</span>
            </div>
          </div>
        </CardFooter>
      </Card>

      <Card className="@container/card bg-gradient-to-t from-primary/5 to-card shadow-sm dark:bg-card">
        <CardHeader className="relative">
          <CardDescription>Active Bookings</CardDescription>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
            {activeBookingsCount}
          </CardTitle>
          <div className="absolute right-4 top-4">
            <Calendar className="size-6 text-green-600 dark:text-green-400" />
          </div>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-2 text-sm">
          <div className="w-full space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-500 dark:text-neutral-400">Completed</span>
              <span className="font-medium">{completedBookingsCount}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-500 dark:text-neutral-400">Cancelled</span>
              <span className="font-medium">{cancelledBookingsCount}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-500 dark:text-neutral-400">Month Revenue</span>
              <span className="font-medium">{formatCurrency(monthlyRevenue)}</span>
            </div>
          </div>
        </CardFooter>
      </Card>

      <Card className="@container/card bg-gradient-to-t from-primary/5 to-card shadow-sm dark:bg-card">
        <CardHeader className="relative">
          <CardDescription>Chauffeurs</CardDescription>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
            {chauffeurCount}
          </CardTitle>
          <div className="absolute right-4 top-4">
            <Users className="size-6 text-purple-600 dark:text-purple-400" />
          </div>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-2 text-sm">
          <div className="w-full space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-500 dark:text-neutral-400">Available</span>
              <span className="font-medium">{availableChauffeursCount}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-500 dark:text-neutral-400">On Duty</span>
              <span className="font-medium">{onDutyChauffeursCount}</span>
            </div>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
