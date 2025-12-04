import { Wallet, ArrowRight, Clock } from "lucide-react";
import { Link } from "@remix-run/react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { formatCurrency } from "~/lib/utils";
import type { NextPayoutInfo } from "./types";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { LAGOS_TIMEZONE } from "~/utils/timezone";

interface NextPayoutCardProps {
  readonly payout?: NextPayoutInfo;
}

export function NextPayoutCard({ payout }: NextPayoutCardProps) {
  if (!payout) {
    return (
      <Card className="@container/card rounded-sm bg-gradient-to-t from-primary/5 to-card shadow-xs dark:bg-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Next Payout
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <div className="rounded-full bg-muted p-3 w-fit mx-auto mb-3">
            <Wallet className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground mb-4">No pending payouts at the moment.</p>
          <Button asChild variant="outline" size="sm">
            <Link to="/fleet-owner/payout-transactions">
              View History
              <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const scheduledDate = toZonedTime(
    typeof payout.scheduledDate === "string"
      ? new Date(payout.scheduledDate)
      : payout.scheduledDate,
    LAGOS_TIMEZONE,
  );

  // Format status label
  const statusLabels: Record<string, string> = {
    PENDING_APPROVAL: "Awaiting Approval",
    PENDING_DISBURSEMENT: "Ready for Payment",
    PROCESSING: "Processing",
    PAID_OUT: "Paid",
    FAILED: "Failed",
    REVERSED: "Reversed",
  };

  const statusLabel = statusLabels[payout.status] || "Pending";

  return (
    <Card className="@container/card rounded-sm shadow-sm border bg-gradient-to-t from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30 border-emerald-200 dark:border-emerald-900">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Wallet className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
            Next Payout
          </CardTitle>
          <Badge
            variant="outline"
            className="bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800"
          >
            {statusLabel}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Amount */}
        <div className="text-center py-4">
          <p className="text-4xl md:text-5xl font-bold text-emerald-900 dark:text-emerald-50 mb-2">
            {formatCurrency(payout.amount)}
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
            <Clock className="h-4 w-4" />
            <span>Processing for {format(scheduledDate, "MMM d, yyyy")}</span>
          </div>
        </div>

        {/* Action */}
        <Button asChild variant="outline" className="w-full" size="sm">
          <Link to="/fleet-owner/payout-transactions">
            View All Transactions
            <ArrowRight className="h-4 w-4 ml-1" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
