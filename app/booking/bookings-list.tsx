import { ChevronRight } from "lucide-react";
import { Link } from "react-router";

import type { BookingListItem, BookingsByStatus } from "~/api/bookings/schema";
import {
  BOOKING_LIST_STATUSES,
  type BookingListStatus,
  bookingListStatusLabel,
  formatBookingListDateTime,
} from "~/booking/bookings-url";
import { formatCurrency } from "~/car/car-domain";
import { cn } from "~/lib/utils";

function BookingRow({ booking }: { readonly booking: BookingListItem }) {
  const imageUrl = booking.car.images[0]?.url;
  const title = `${booking.car.make} ${booking.car.model}`;
  const startLabel = formatBookingListDateTime(booking.startDate);
  const endLabel = formatBookingListDateTime(booking.endDate);

  return (
    <li className="border-b last:border-0">
      <Link
        to={`/bookings/${booking.id}`}
        prefetch="intent"
        className="flex flex-col justify-between px-2 py-4 sm:flex-row"
      >
        <div className="flex w-full min-w-0 items-center gap-4">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={`${title} (${booking.car.year})`}
              width={40}
              height={40}
              loading="lazy"
              className="h-10 w-10 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div aria-hidden="true" className="h-10 w-10 shrink-0 rounded-full bg-gray-100" />
          )}
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-pretty text-sm font-semibold">
                {title} ({booking.car.year}) -{" "}
                <span translate="no" className="italic text-gray-500">
                  {booking.bookingReference}
                </span>
              </h2>
              {booking.status === "COMPLETED" ? (
                <span
                  className={cn(
                    "inline-flex items-center rounded-sm border px-2.5 py-0.5 text-xs font-semibold",
                    booking.reviewed
                      ? "border-green-200 bg-green-50 text-green-700"
                      : "border-amber-200 bg-amber-50 text-amber-700",
                  )}
                >
                  {booking.reviewed ? "Reviewed" : "Review Pending"}
                </span>
              ) : null}
            </div>
            <div className="space-y-1 text-pretty text-sm text-gray-600">
              <p className="hidden sm:block">
                {startLabel} to {endLabel}
              </p>
              <p className="block sm:hidden">{startLabel}</p>
              <p className="block sm:hidden">{endLabel}</p>
              <p className="text-pretty text-sm font-semibold tabular-nums">
                {formatCurrency(booking.totalAmount, booking.currency ?? undefined)}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-2 flex flex-col items-center justify-center gap-2 sm:mt-0 sm:flex-row">
          <ChevronRight aria-hidden="true" className="hidden h-4 w-4 text-gray-500 sm:block" />
        </div>
      </Link>
    </li>
  );
}

export function BookingsList({
  bookings,
  status,
}: {
  readonly bookings: BookingsByStatus;
  readonly status: BookingListStatus;
}) {
  const rows = bookings[status] ?? [];

  return (
    <div className="w-full">
      <div className="mx-auto max-w-4xl px-4 py-4 md:py-6">
        <h1 className="mb-4 text-pretty text-2xl font-bold">Your Bookings</h1>

        <nav
          aria-label="Booking status"
          className="flex h-10 items-center justify-start space-x-4 overflow-x-auto rounded-md bg-white p-0 text-muted-foreground"
        >
          {BOOKING_LIST_STATUSES.map((tabStatus) => {
            const isCurrent = tabStatus === status;

            return (
              <Link
                key={tabStatus}
                to={`?status=${tabStatus.toLowerCase()}`}
                prefetch="intent"
                aria-current={isCurrent ? "page" : undefined}
                className={cn(
                  "inline-flex touch-manipulation items-center justify-center gap-1 rounded border px-3 py-1.5 text-sm font-medium whitespace-nowrap antialiased ring-offset-background transition-[color,background-color,border-color,box-shadow] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none motion-reduce:transition-none",
                  isCurrent && "border-primary bg-background text-foreground shadow-sm",
                )}
              >
                {bookingListStatusLabel(tabStatus)}
                <span>({bookings[tabStatus]?.length ?? 0})</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-2 rounded border border-gray-200 shadow-md" aria-live="polite">
          {rows.length === 0 ? (
            <p className="py-8 text-center text-gray-500">No {status.toLowerCase()} bookings</p>
          ) : (
            <ul className="flex flex-col">
              {rows.map((booking) => (
                <BookingRow key={booking.id} booking={booking} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
