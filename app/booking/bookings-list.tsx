import { cn } from "cn";
import { Calendar, ChevronRight, Clock } from "lucide-react";
import { Link } from "react-router";
import type { BookingListItem, BookingsByStatus } from "~/api/bookings/schema";
import {
  BOOKING_LIST_STATUSES,
  type BookingListStatus,
  bookingListStatusLabel,
  formatBookingListDateRange,
  formatBookingListTime,
} from "~/booking/bookings-url";
import { formatCurrency } from "~/money/currency";

function BookingRow({
  booking,
  showDivider,
}: {
  readonly booking: BookingListItem;
  readonly showDivider: boolean;
}) {
  const imageUrl = booking.car.images[0]?.url;
  const title = `${booking.car.make} ${booking.car.model}`;
  const dateLabel = formatBookingListDateRange(booking.startDate, booking.endDate);
  const timeLabel = formatBookingListTime(booking.startDate);

  return (
    <li className="border-gray-200 md:border-b md:last:border-b-0">
      {showDivider ? (
        <div aria-hidden="true" className="my-4 h-px w-full bg-gray-200 md:hidden" />
      ) : null}
      <Link
        to={`/bookings/${booking.id}`}
        prefetch="intent"
        className="flex flex-col justify-between sm:flex-row md:p-6"
      >
        <div className="flex w-full min-w-0 items-start gap-2 md:gap-5">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={`${title} (${booking.car.year})`}
              width={68}
              height={84}
              loading="lazy"
              className="h-[84px] w-[68px] shrink-0 rounded object-cover md:h-[86px] md:w-[114px]"
            />
          ) : (
            <div
              aria-hidden="true"
              className="h-[84px] w-[68px] shrink-0 rounded bg-gray-200 md:h-[86px] md:w-[114px]"
            />
          )}
          <div className="flex min-w-0 flex-col gap-1">
            <p translate="no" className="text-xs leading-none font-bold text-green-600 md:text-sm">
              {booking.bookingReference}
            </p>
            <h2 className="text-sm leading-5 font-semibold text-pretty text-gray-900">
              {title} ({booking.car.year})
            </h2>
            <p className="text-sm leading-5 font-semibold text-pretty text-gray-900 tabular-nums">
              {formatCurrency(booking.totalAmount, booking.currency ?? undefined)}
            </p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-5 text-gray-900 md:text-sm">
              <span className="inline-flex items-center gap-1">
                <Calendar aria-hidden="true" className="h-4 w-4 shrink-0" />
                {dateLabel}
              </span>
              <span aria-hidden="true" className="h-3.5 w-px bg-gray-400 md:h-4" />
              <span className="inline-flex items-center gap-1">
                <Clock aria-hidden="true" className="h-4 w-4 shrink-0" />
                {timeLabel}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-2 hidden items-center justify-center gap-2 sm:mt-0 sm:flex sm:flex-row">
          <ChevronRight aria-hidden="true" className="h-4 w-4 text-gray-500" />
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
        <h1 className="mb-4 text-2xl leading-9 font-semibold tracking-tight text-gray-900 md:mb-6 md:text-3xl md:tracking-normal">
          Bookings
        </h1>

        <nav aria-label="Booking status" className="flex items-center gap-4 overflow-x-auto">
          {BOOKING_LIST_STATUSES.map((tabStatus) => {
            const isCurrent = tabStatus === status;

            return (
              <Link
                key={tabStatus}
                to={`?status=${tabStatus.toLowerCase()}`}
                prefetch="intent"
                aria-current={isCurrent ? "page" : undefined}
                className={cn(
                  "inline-flex shrink-0 touch-manipulation items-center justify-center rounded border border-gray-300 bg-white px-3 py-1.5 text-xs leading-5 font-medium whitespace-nowrap text-gray-900 shadow-sm ring-offset-background transition-[color,background-color,border-color,box-shadow] hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none motion-reduce:transition-none md:text-sm",
                  isCurrent && "border-gray-900 bg-gray-900 text-white hover:bg-gray-900",
                )}
              >
                {bookingListStatusLabel(tabStatus)} ({bookings[tabStatus]?.length ?? 0})
              </Link>
            );
          })}
        </nav>

        <div
          className="mt-4 rounded-lg border border-gray-200 p-4 shadow-[0_4px_20px_rgb(0_0_0/0.25)] md:mt-[30px] md:p-0 md:shadow-[0_4px_10px_rgb(0_0_0/0.08)]"
          aria-live="polite"
        >
          {rows.length === 0 ? (
            <p className="py-8 text-center text-gray-500">No {status.toLowerCase()} bookings</p>
          ) : (
            <ul className="flex flex-col">
              {rows.map((booking, index) => (
                <BookingRow key={booking.id} booking={booking} showDivider={index > 0} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
