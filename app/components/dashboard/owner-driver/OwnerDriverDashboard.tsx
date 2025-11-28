import { NowCard } from "./NowCard";
import { EarningsSnapshot } from "./EarningsSnapshot";
import { UpcomingTimeline } from "./UpcomingTimeline";
import { CarStatusCard } from "./CarStatusCard";
import { NextPayoutCard } from "./NextPayoutCard";
import { RecentActivity } from "./RecentActivity";
import type { OwnerDriverDashboardData } from "./types";
import { format } from "date-fns";
import { formatCurrency } from "~/lib/utils";

interface WelcomeMessageProps {
  readonly name: string;
  readonly activeBookingCount: number;
  readonly weeklyEarnings: number;
}

function WelcomeMessage({ name, activeBookingCount, weeklyEarnings }: WelcomeMessageProps) {
  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  })();

  const today = format(new Date(), "EEEE, MMMM d");

  return (
    <div className="space-y-2">
      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight">Welcome back, {name}</h1>
        <p className="text-sm text-muted-foreground">
          {today}, {greeting}
        </p>
      </div>

      {activeBookingCount > 0 ? (
        <p className="text-sm md:text-base text-muted-foreground">
          {greeting}! You have{" "}
          <span className="font-semibold text-foreground">
            {activeBookingCount} active {activeBookingCount === 1 ? "booking" : "bookings"}
          </span>
          {weeklyEarnings > 0 && (
            <>
              {" "}
              and you're on track to earn{" "}
              <span className="font-semibold text-green-700 dark:text-green-400">
                {formatCurrency(weeklyEarnings)}
              </span>{" "}
              this week
            </>
          )}
          .
        </p>
      ) : (
        <p className="text-sm md:text-base text-muted-foreground">
          {weeklyEarnings > 0 && (
            <>
              . You've earned{" "}
              <span className="font-semibold text-green-700 dark:text-green-400">
                {formatCurrency(weeklyEarnings)}
              </span>{" "}
              this week
            </>
          )}
          .
        </p>
      )}
    </div>
  );
}

export function OwnerDriverDashboard({
  name,
  currentOrNextBooking,
  upcomingBookings,
  recentBookings,
  car,
  earnings,
  nextPayout,
}: OwnerDriverDashboardData) {
  const activeBookingCount = currentOrNextBooking?.status === "ACTIVE" ? 1 : 0;

  return (
    <div className="@container/main space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      <WelcomeMessage
        name={name}
        activeBookingCount={activeBookingCount}
        weeklyEarnings={earnings.thisWeek.amount}
      />

      <NowCard booking={currentOrNextBooking} todayEarnings={earnings.today} />

      <EarningsSnapshot earnings={earnings} />

      <UpcomingTimeline bookings={upcomingBookings} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CarStatusCard car={car} />
        <NextPayoutCard payout={nextPayout} />
      </div>

      <RecentActivity bookings={recentBookings} />
    </div>
  );
}
