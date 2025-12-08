import { TrendingUp, Calendar, Wallet } from "lucide-react";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { formatCurrency } from "~/lib/utils";
import type { EarningsData } from "../owner-driver/types";

interface EarningsCardProps {
  readonly label: string;
  readonly amount: number;
  readonly subtitle: string;
  readonly icon: React.ReactNode;
}

function EarningsCard({ label, amount, subtitle, icon }: EarningsCardProps) {
  return (
    <Card className="@container/card rounded-sm bg-gradient-to-t from-primary/5 to-card shadow-xs dark:bg-card">
      <CardHeader className="relative">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
          {formatCurrency(amount)}
        </CardTitle>
        <div className="absolute right-4 top-4">{icon}</div>
      </CardHeader>
      <CardFooter className="flex-col items-start gap-1 text-sm">
        <div className="text-neutral-500 dark:text-neutral-400">{subtitle}</div>
      </CardFooter>
    </Card>
  );
}

interface EarningsSnapshotProps {
  readonly earnings: EarningsData;
}

export function EarningsSnapshot({ earnings }: EarningsSnapshotProps) {
  return (
    <div className="@md/main:grid-cols-3 @3xl/main:grid-cols-3 grid grid-cols-1 gap-4">
      <EarningsCard
        label="Today"
        amount={earnings.today}
        subtitle={earnings.today > 0 ? "Keep it going!" : "Ready for bookings"}
        icon={<Wallet className="size-5 text-blue-600 dark:text-blue-400" />}
      />

      <EarningsCard
        label="This Week"
        amount={earnings.thisWeek.amount}
        subtitle={
          earnings.thisWeek.bookingCount === 1
            ? "From 1 booking"
            : `From ${earnings.thisWeek.bookingCount} bookings`
        }
        icon={<TrendingUp className="size-5 text-green-600 dark:text-green-400" />}
      />

      <EarningsCard
        label="This Month"
        amount={earnings.thisMonth.amount}
        subtitle={
          earnings.thisMonth.bookingCount === 1
            ? "From 1 booking"
            : `From ${earnings.thisMonth.bookingCount} bookings`
        }
        icon={<Calendar className="size-5 text-purple-600 dark:text-purple-400" />}
      />
    </div>
  );
}
