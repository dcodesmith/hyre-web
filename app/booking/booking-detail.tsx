import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";

import type { BookingDetail } from "~/api/bookings/schema";
import { BookingCancelCard } from "~/booking/booking-cancel";
import { BookingChauffeurCard } from "~/booking/booking-chauffeur-card";
import { BookingDomain } from "~/booking/booking-domain";
import { BookingFlightCard } from "~/booking/booking-flight-card";
import { BookingHeader } from "~/booking/booking-header";
import { BookingLocationCard } from "~/booking/booking-location-card";
import { BookingPaymentCard } from "~/booking/booking-payment-card";
import { BookingTimelineCard } from "~/booking/booking-timeline";
import { bookingListPath, parseBookingListStatus } from "~/booking/bookings-url";

export function BookingDetailPage({
  booking: detail,
  now,
}: {
  readonly booking: BookingDetail;
  readonly now: string;
}) {
  const booking = BookingDomain(detail, new Date(now));
  const backTo = bookingListPath(
    parseBookingListStatus(new URLSearchParams({ status: detail.status.toLowerCase() })),
  );

  return (
    <div className="w-full text-base">
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-4 md:py-6">
        <div className="hidden items-center gap-2 md:flex">
          <Link to={backTo} className="flex text-sm hover:underline">
            &larr; Back to Bookings
          </Link>
        </div>

        <div className="flex min-w-0 flex-row gap-2">
          <div className="flex items-start gap-2 md:hidden">
            <Link
              to={backTo}
              className="rounded-full bg-muted/50 p-2 transition-opacity hover:bg-muted/75"
              aria-label="Back to Bookings"
            >
              <ArrowLeft className="h-5 w-5 text-black" aria-hidden="true" />
            </Link>
          </div>
          <BookingHeader booking={booking} />
        </div>

        <div className="relative w-full rounded border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm text-blue-800">{booking.typeDescription}</p>
        </div>

        <div className="grid gap-4 md:gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <BookingTimelineCard legs={booking.legs} />
            <BookingLocationCard booking={booking} />
          </div>

          <div className="space-y-6">
            <BookingChauffeurCard booking={booking} />
            {booking.flight ? <BookingFlightCard flight={booking.flight} /> : null}
            <BookingPaymentCard payment={booking.payment} />
            {detail.canCancel ? <BookingCancelCard paymentStatus={detail.paymentStatus} /> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
