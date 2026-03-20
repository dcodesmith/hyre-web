import { useFetcher } from "react-router";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { Calendar, Clock, MapPin, User } from "lucide-react";
import { useState } from "react";
import { useAuthenticityToken } from "remix-utils/csrf/react";
import { Button } from "~/components/ui/button";
import { getTimeRemainingForLiveBooking, getTimeUntilBooking } from "~/lib/booking-utils";
import { formatCurrency } from "~/lib/utils";
import type { BookingWithRelations } from "~/types";
import { LAGOS_TIMEZONE } from "~/utils/timezone";
import { BookingDetailsSheet } from "./BookingDetailsSheet";

export type BookingStatusType = "action-required" | "live" | "upcoming";

interface UnifiedBookingItemProps {
  readonly booking: BookingWithRelations;
  readonly statusType: BookingStatusType;
}

type BookingTimeInfo = {
  readonly time: string;
  readonly isNextLeg: boolean;
  readonly isEnded: boolean;
};

function getTimeDisplayText(
  timeInfo: BookingTimeInfo | null,
  timeRemaining: string,
  statusType: BookingStatusType,
): string {
  if (timeInfo?.isEnded) return "Ended";
  if (timeInfo?.isNextLeg) return `${timeRemaining} till next leg starts`;
  if (statusType === "live") return `${timeRemaining} remaining`;
  return `in ${timeRemaining}`;
}

export function UnifiedBookingItem({ booking, statusType }: UnifiedBookingItemProps) {
  const fetcher = useFetcher();
  const csrfToken = useAuthenticityToken();
  const isSubmitting = fetcher.state === "submitting";
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const guestUser = booking.guestUser as { email?: string; phoneNumber?: string } | null;
  const customerName = booking.user?.name || booking.user?.email || guestUser?.email || "Guest";

  const startDate = toZonedTime(new Date(booking.startDate), LAGOS_TIMEZONE);
  const endDate = toZonedTime(new Date(booking.endDate), LAGOS_TIMEZONE);

  // Get time remaining for live bookings or time until upcoming/action-required bookings
  let timeRemaining: string | null = null;
  let timeInfo: BookingTimeInfo | null = null;
  if (statusType === "live") {
    timeInfo = getTimeRemainingForLiveBooking(booking);
    timeRemaining = timeInfo?.time ?? null;
  } else if (statusType === "upcoming" || statusType === "action-required") {
    timeRemaining = getTimeUntilBooking(booking);
  }

  const showAcceptButton = statusType === "action-required";

  return (
    <div className="@container/card shadow-sm rounded-sm border p-4 space-y-3 bg-gradient-to-t from-primary/5 to-card shadow-xs dark:bg-card w-full min-w-0 flex-1">
      <div className="flex items-center justify-between gap-4 min-w-0">
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-mono font-semibold">{booking.bookingReference}</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-base font-bold">{formatCurrency(Number(booking.totalAmount))}</div>
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm min-w-0">
        <User className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="font-medium truncate">{customerName}</span>
      </div>

      <div className="flex items-start gap-2 text-sm min-w-0">
        <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
        <div className="min-w-0 flex-1">
          <span className="font-medium">{format(startDate, "MMM d, h:mm a")}</span>
          <span className="text-muted-foreground"> → {format(endDate, "MMM d, h:mm a")}</span>
        </div>
      </div>

      {timeRemaining &&
        (() => {
          let clockClassName = "h-4 w-4 shrink-0 ";
          let textClassName = "font-medium ";

          if (statusType === "live") {
            clockClassName += "text-blue-600 dark:text-blue-400";
            textClassName += "text-blue-600 dark:text-blue-400";
          } else if (statusType === "action-required") {
            clockClassName += "text-orange-600 dark:text-orange-400";
            textClassName += "text-orange-600 dark:text-orange-400";
          } else {
            clockClassName += "text-slate-600 dark:text-slate-400";
            textClassName += "text-slate-600 dark:text-slate-400";
          }

          const displayText = getTimeDisplayText(timeInfo, timeRemaining, statusType);

          return (
            <div className="flex items-center gap-2 text-sm">
              <Clock className={clockClassName} />
              <span className={textClassName}>{displayText}</span>
            </div>
          );
        })()}

      <div className="flex items-start gap-2 text-sm min-w-0">
        <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
        <span className="line-clamp-1 min-w-0">{booking.pickupLocation}</span>
      </div>

      {(() => {
        let errorMessage: string | null = null;
        if (fetcher.data && typeof fetcher.data === "object" && "error" in fetcher.data) {
          if (typeof fetcher.data.error === "string") {
            errorMessage = fetcher.data.error;
          } else {
            errorMessage = String(fetcher.data.error);
          }
        }

        if (!errorMessage) {
          return null;
        }

        return (
          <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded p-2">
            {errorMessage}
          </div>
        );
      })()}

      <div className="flex flex-col sm:flex-row sm:justify-center gap-2 pt-2">
        {showAcceptButton && (
          <fetcher.Form
            method="PATCH"
            action={`/fleet-owner/bookings/${booking.id}`}
            className="contents"
          >
            <input type="hidden" name="csrf" value={csrfToken} />
            <input type="hidden" name="chauffeurId" value={booking.car.ownerId} />
            <Button
              type="submit"
              variant="default"
              className="w-full sm:w-auto"
              size="sm"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Accepting..." : "Accept Booking"}
            </Button>
          </fetcher.Form>
        )}
        <Button
          variant="outline"
          className="w-full sm:w-auto"
          size="sm"
          onClick={() => setIsSheetOpen(true)}
        >
          View Details
        </Button>
      </div>

      <BookingDetailsSheet booking={booking} open={isSheetOpen} onOpenChange={setIsSheetOpen} />
    </div>
  );
}
