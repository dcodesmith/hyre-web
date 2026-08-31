import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";

import type { BookingDetail } from "~/api/bookings/schema";
import { authPath } from "~/auth/referer";
import { BookingCancelCard } from "~/booking/booking-cancel";
import { BookingChauffeurCard } from "~/booking/booking-chauffeur-card";
import { BookingDomain } from "~/booking/booking-domain";
import { BookingExtendCard } from "~/booking/booking-extend-card";
import { BookingFlightCard } from "~/booking/booking-flight-card";
import { BookingHeader } from "~/booking/booking-header";
import { BookingLocationCard } from "~/booking/booking-location-card";
import { BookingModifyCard } from "~/booking/booking-modify";
import { BookingPaymentCard } from "~/booking/booking-payment-card";
import { BookingTimelineCard } from "~/booking/booking-timeline";
import { bookingListPath, parseBookingListStatus } from "~/booking/bookings-url";
import { BookingReview, type BookingReviewAvailability } from "~/review/booking-review";

const RECEIPT_PAYMENT_STATUSES: readonly BookingDetail["paymentStatus"][] = [
  "PAID",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
];

export function BookingDetailPage({
  accessMode = "account",
  booking: detail,
  canDownloadReceipt,
  reviewAvailability,
  now,
}: {
  readonly accessMode?: "account" | "guest";
  readonly booking: BookingDetail;
  readonly canDownloadReceipt: boolean;
  readonly reviewAvailability: BookingReviewAvailability;
  readonly now: string;
}) {
  const booking = BookingDomain(detail, new Date(now));
  const isGuest = accessMode === "guest";
  const backTo = isGuest
    ? "/bookings/lookup"
    : bookingListPath(
        parseBookingListStatus(new URLSearchParams({ status: detail.status.toLowerCase() })),
      );
  const backLabel = isGuest ? "Back to booking lookup" : "Back to Bookings";
  const receiptPath =
    canDownloadReceipt &&
    detail.status === "COMPLETED" &&
    RECEIPT_PAYMENT_STATUSES.includes(detail.paymentStatus)
      ? `/bookings/${encodeURIComponent(detail.id)}/receipt`
      : undefined;

  return (
    <div className="w-full text-base">
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-4 md:py-6">
        <div className="hidden items-center gap-2 md:flex">
          <Link to={backTo} className="flex text-sm hover:underline">
            &larr; {backLabel}
          </Link>
        </div>

        <div className="flex min-w-0 flex-row gap-2">
          <div className="flex items-start gap-2 md:hidden">
            <Link
              to={backTo}
              className="rounded-full bg-muted/50 p-2 transition-opacity hover:bg-muted/75"
              aria-label={backLabel}
            >
              <ArrowLeft className="h-5 w-5 text-black" aria-hidden="true" />
            </Link>
          </div>
          <BookingHeader booking={booking} />
        </div>

        {isGuest ? (
          <div className="rounded border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            Guest access is read-only.{" "}
            <Link
              to={authPath("/auth", { redirectTo: `/bookings/${encodeURIComponent(detail.id)}` })}
              className="font-medium underline underline-offset-4"
            >
              Sign in with the booking email
            </Link>{" "}
            to manage this booking.
          </div>
        ) : null}

        <div className="relative w-full rounded border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm text-blue-800">{booking.typeDescription}</p>
        </div>

        <div className="grid gap-4 md:gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <BookingTimelineCard legs={booking.legs} />
            <BookingLocationCard booking={booking} />
            {!isGuest && reviewAvailability !== "hidden" && detail.status === "COMPLETED" ? (
              <BookingReview
                review={detail.review ?? null}
                availability={reviewAvailability}
                now={now}
              />
            ) : null}
          </div>

          <div className="space-y-6">
            <BookingChauffeurCard booking={booking} />
            {booking.flight ? <BookingFlightCard flight={booking.flight} /> : null}
            <BookingPaymentCard payment={booking.payment} receiptPath={receiptPath} />
            {!isGuest && detail.legs.some((leg) => leg.canExtend) ? (
              <BookingExtendCard bookingId={detail.id} />
            ) : null}
            {!isGuest && detail.canEdit ? <BookingModifyCard booking={detail} /> : null}
            {!isGuest && detail.canCancel ? (
              <BookingCancelCard paymentStatus={detail.paymentStatus} />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
