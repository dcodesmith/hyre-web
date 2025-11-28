import { Calendar, TrendingUp } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { formatCurrency } from "~/lib/utils";

interface TodaysActivityProps {
  readonly activeBookings: number;
  readonly confirmedBookings: number;
  readonly completedBookings: number;
  readonly cancelledBookings: number;
  readonly projectedRevenue: number;
}

export function TodaysActivity({
  activeBookings,
  confirmedBookings,
  completedBookings,
  cancelledBookings,
  projectedRevenue,
}: TodaysActivityProps) {
  const totalBookings = activeBookings + confirmedBookings + completedBookings + cancelledBookings;

  const today = new Date();
  const formattedDate = today.toLocaleDateString("en-NG", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <Card className="@container/card bg-gradient-to-t from-primary/5 to-card shadow-sm dark:bg-card">
      <CardHeader className="relative">
        <CardDescription>Today's Activity</CardDescription>
        <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold">
          {formattedDate}
        </CardTitle>
        <div className="absolute right-4 top-4">
          <Calendar className="size-5 text-blue-600 dark:text-blue-400" />
        </div>
      </CardHeader>
      <CardContent className="pb-2">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Active</span>
            <span className="font-semibold tabular-nums">{activeBookings}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Starting Today</span>
            <span className="font-semibold tabular-nums">{confirmedBookings}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Completed</span>
            <span className="font-semibold tabular-nums">{completedBookings}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Cancelled</span>
            <span className="font-semibold tabular-nums">{cancelledBookings}</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-1 pt-4 text-sm">
        {totalBookings === 0 ? (
          <div className="text-neutral-500 dark:text-neutral-400">
            No bookings scheduled for today
          </div>
        ) : totalBookings === cancelledBookings ? (
          <div className="text-neutral-500 dark:text-neutral-400">
            All bookings for today were cancelled
          </div>
        ) : activeBookings > 0 || completedBookings > 0 ? (
          <div className="flex items-center gap-2">
            <TrendingUp className="size-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-neutral-500 dark:text-neutral-400">
              Projected revenue:{" "}
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                {formatCurrency(projectedRevenue)}
              </span>
            </span>
          </div>
        ) : (
          <div className="text-neutral-500 dark:text-neutral-400">
            {confirmedBookings} booking{confirmedBookings === 1 ? "" : "s"} starting today
          </div>
        )}
      </CardFooter>
    </Card>
  );
}
