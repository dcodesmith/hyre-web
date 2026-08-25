import { CheckCircle, CreditCard } from "lucide-react";
import { OutlineBadge } from "~/booking/booking-detail-card";
import type { BookingView } from "~/booking/booking-domain";
import { cn } from "~/lib/utils";

const PAYMENT_STATUS_CLASS = {
  REFUNDED: "bg-blue-100 text-blue-800 border-blue-200",
  PAID: "bg-green-100 text-green-800 border-green-200",
} as const;

export function BookingHeader({ booking }: { readonly booking: BookingView }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="flex min-w-0 flex-col gap-2 text-base md:flex-row md:items-center">
        <h1 className="min-w-0 text-pretty text-base font-semibold break-words">{booking.name}</h1>
        <span translate="no" className="text-sm text-gray-600 md:text-gray-900">
          {booking.bookingReference}
        </span>
      </div>
      <div className="flex flex-wrap gap-2 md:items-end">
        <OutlineBadge
          className={cn(
            booking.isCancelled
              ? "border-red-200 bg-red-100 text-red-800"
              : "border-green-200 bg-green-100 text-green-800",
          )}
        >
          <CheckCircle className="mr-1 h-3 w-3" aria-hidden="true" />
          {booking.statusLabel}
        </OutlineBadge>
        <OutlineBadge
          className={
            PAYMENT_STATUS_CLASS[booking.paymentStatus as keyof typeof PAYMENT_STATUS_CLASS] ??
            "bg-yellow-100 text-yellow-800 border-yellow-200"
          }
        >
          <CreditCard className="mr-1 h-3 w-3" aria-hidden="true" />
          {booking.paymentStatusLabel}
        </OutlineBadge>
      </div>
    </div>
  );
}
