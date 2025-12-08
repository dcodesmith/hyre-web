import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { formatCurrency } from "~/lib/utils";
import { LAGOS_TIMEZONE } from "~/utils/timezone";

export interface WelcomeMessageProps {
  readonly name: string;
  readonly activeBookingCount: number;
  readonly weeklyEarnings: number;
}

function getGreeting() {
  const lagosNow = toZonedTime(new Date(), LAGOS_TIMEZONE);
  const hour = lagosNow.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function WelcomeMessage({ name, activeBookingCount, weeklyEarnings }: WelcomeMessageProps) {
  const greeting = getGreeting();
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
          {weeklyEarnings > 0 ? (
            <>
              {" "}
              and you're on track to earn{" "}
              <span className="font-semibold text-green-700 dark:text-green-400">
                {formatCurrency(weeklyEarnings)}
              </span>{" "}
              this week.
            </>
          ) : (
            "."
          )}
        </p>
      ) : (
        <p className="text-sm md:text-base text-muted-foreground">
          {weeklyEarnings > 0 && (
            <>
              You've earned{" "}
              <span className="font-semibold text-green-700 dark:text-green-400">
                {formatCurrency(weeklyEarnings)}
              </span>{" "}
              this week.
            </>
          )}
        </p>
      )}
    </div>
  );
}

