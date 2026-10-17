import type { ReactNode } from "react";
import type { BookingView } from "~/booking/booking-domain";

const BOOKING_STATUS_PILL = {
  PENDING: { pill: "border-amber-600/20 bg-amber-50 text-amber-800", dot: "bg-amber-500" },
  CONFIRMED: {
    pill: "border-emerald-600/20 bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
  },
  ACTIVE: { pill: "border-blue-600/20 bg-blue-50 text-blue-700", dot: "bg-blue-500" },
  COMPLETED: { pill: "border-slate-500/20 bg-slate-50 text-slate-700", dot: "bg-slate-500" },
  CANCELLED: { pill: "border-red-600/20 bg-red-50 text-red-700", dot: "bg-red-500" },
  REJECTED: { pill: "border-red-600/20 bg-red-50 text-red-700", dot: "bg-red-500" },
} as const satisfies Record<BookingView["status"], { pill: string; dot: string }>;

const PAYMENT_STATUS_PILL = {
  UNPAID: { pill: "border-amber-600/20 bg-amber-50 text-amber-800", dot: "bg-amber-500" },
  PAID: { pill: "border-emerald-600/20 bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  REFUNDED: { pill: "border-blue-600/20 bg-blue-50 text-blue-700", dot: "bg-blue-500" },
  PARTIALLY_REFUNDED: { pill: "border-blue-600/20 bg-blue-50 text-blue-700", dot: "bg-blue-500" },
  REFUND_PROCESSING: {
    pill: "border-amber-600/20 bg-amber-50 text-amber-800",
    dot: "bg-amber-500",
  },
  REFUND_FAILED: { pill: "border-red-600/20 bg-red-50 text-red-700", dot: "bg-red-500" },
} as const satisfies Record<BookingView["paymentStatus"], { pill: string; dot: string }>;

function statusText(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function StatusPill({
  label,
  className,
  dotClassName,
}: {
  readonly label: string;
  readonly className: string;
  readonly dotClassName: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs leading-4 font-medium ${className}`}
    >
      <span className={`size-1.5 rounded-full ${dotClassName}`} aria-hidden="true" />
      {label}
    </span>
  );
}

export function BookingHeader({
  booking,
  actions,
}: {
  readonly booking: BookingView;
  readonly actions?: ReactNode;
}) {
  const bookingStatus = BOOKING_STATUS_PILL[booking.status];
  const paymentStatus = PAYMENT_STATUS_PILL[booking.paymentStatus];
  const referenceClass =
    booking.status === "CANCELLED" || booking.status === "REJECTED"
      ? "text-gray-500"
      : "text-emerald-500";

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p translate="no" className={`text-sm leading-none font-bold ${referenceClass}`}>
            {booking.bookingReference}
          </p>
          <StatusPill
            label={statusText(booking.status)}
            className={bookingStatus.pill}
            dotClassName={bookingStatus.dot}
          />
          <StatusPill
            label={statusText(booking.paymentStatus)}
            className={paymentStatus.pill}
            dotClassName={paymentStatus.dot}
          />
        </div>
        <h1 className="text-2xl leading-8 font-semibold tracking-tight text-pretty break-words text-gray-900">
          {booking.name}
        </h1>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
