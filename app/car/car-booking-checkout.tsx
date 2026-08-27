import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

import type { BookingPricingPreview } from "~/api/bookings/schema";
import type { TripDurationResponse } from "~/api/flights/schema";
import {
  BookingCostBreakdown,
  BookingCostBreakdownSkeleton,
} from "~/booking/booking-cost-breakdown";
import { TripDetails } from "~/booking/trip-details";
import { AIRPORT_PICKUP_BOOKING_TYPE, type BookingType } from "~/booking/types";
import { FormError } from "~/components/forms/form-primitives";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardFooter } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";
import { formatCurrency } from "~/money/currency";

const bookingCardShellClassName =
  "lg:rounded lg:border lg:bg-card lg:shadow-xl lg:inset-shadow-sm lg:transform-gpu";
const bookingCardClassName =
  "gap-0 overflow-visible rounded border py-0 shadow-xl inset-shadow-sm ring-0 transform-gpu";
const bookingCardInnerClassName = `${bookingCardClassName} lg:rounded-none lg:border-0 lg:bg-transparent lg:shadow-none lg:inset-shadow-none`;
const bookingCardContentClassName = "space-y-4 px-4 pb-6 [&>div:first-of-type]:mt-0 lg:px-6";

interface CheckoutState {
  readonly guest: ReactNode;
  readonly preview: BookingPricingPreview | null;
  readonly pricingError: string | null;
  readonly isPricingLoading: boolean;
  readonly canPay: boolean;
  readonly errorId: string;
  readonly bookingErrors: readonly string[];
  readonly isPaying: boolean;
  readonly isSignedIn: boolean;
  readonly signInHref: string;
}

function CarBookingPayActions({
  isPaying,
  isSignedIn,
  signInHref,
  canPay,
}: {
  readonly isPaying: boolean;
  readonly isSignedIn: boolean;
  readonly signInHref: string;
  readonly canPay: boolean;
}) {
  const payLabel = isSignedIn ? "Pay Now" : "Pay Now as Guest";

  return (
    <div className="flex flex-col space-y-2">
      <Button
        type="submit"
        className="h-10 w-full rounded-full px-4"
        disabled={isPaying || !canPay}
        aria-busy={isPaying}
      >
        {isPaying ? (
          <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        ) : (
          payLabel
        )}
      </Button>
      {isSignedIn ? null : (
        <div className="flex items-center justify-center pt-1 text-sm">
          <span>Have an account?</span>
          <Link
            to={signInHref}
            className="inline-flex h-10 items-center px-1 font-medium underline"
          >
            Sign in to book
          </Link>
        </div>
      )}
    </div>
  );
}

function MobilePayTotal({
  preview,
  isPricingLoading,
}: {
  readonly preview: BookingPricingPreview | null;
  readonly isPricingLoading: boolean;
}) {
  if (preview) {
    return (
      <span className="text-right text-base font-semibold tabular-nums">
        {formatCurrency(preview.totalAmount, preview.currency)}
      </span>
    );
  }

  if (isPricingLoading) {
    return <Skeleton className="h-5 w-20" aria-hidden="true" />;
  }

  return <span className="text-right text-base font-semibold tabular-nums">—</span>;
}

function CarBookingMobilePayBar({
  preview,
  isPricingLoading,
  isPaying,
  isSignedIn,
  signInHref,
  errorId,
  bookingErrors,
  canPay,
}: Omit<CheckoutState, "guest" | "pricingError">) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-xl border-t bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_rgba(0,0,0,0.1)] lg:hidden">
      {bookingErrors.length > 0 ? (
        <div className="border-b border-red-200 bg-red-50 px-4 py-2">
          <FormError id={errorId} errors={bookingErrors} />
        </div>
      ) : null}
      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-gray-600">Total</span>
          <MobilePayTotal preview={preview} isPricingLoading={isPricingLoading} />
        </div>
        <CarBookingPayActions
          isPaying={isPaying}
          isSignedIn={isSignedIn}
          signInHref={signInHref}
          canPay={canPay}
        />
      </div>
    </div>
  );
}

function mobileCheckoutPadding(isSignedIn: boolean, isAirportPickup: boolean) {
  if (isSignedIn) {
    return "pb-40";
  }

  return isAirportPickup ? "pb-52" : "pb-48";
}

function PricingBreakdown({
  preview,
  isPricingLoading,
  bookingType,
}: {
  readonly preview: BookingPricingPreview | null;
  readonly isPricingLoading: boolean;
  readonly bookingType: BookingType;
}) {
  if (preview) {
    return <BookingCostBreakdown preview={preview} bookingType={bookingType} />;
  }

  return isPricingLoading ? <BookingCostBreakdownSkeleton /> : null;
}

function CarBookingCheckoutSummary({
  tripArrivalTime,
  tripDuration,
  preview,
  pricingError,
  isPricingLoading,
  bookingType,
  errorId,
  bookingErrors,
  showErrors = false,
}: {
  readonly tripArrivalTime: string | null;
  readonly tripDuration: TripDurationResponse | null;
  readonly errorId?: string;
  readonly showErrors?: boolean;
  readonly bookingType: BookingType;
} & Pick<CheckoutState, "preview" | "pricingError" | "isPricingLoading" | "bookingErrors">) {
  return (
    <>
      {tripArrivalTime && tripDuration ? (
        <TripDetails arrivalTime={tripArrivalTime} duration={tripDuration} />
      ) : null}
      <PricingBreakdown
        preview={preview}
        isPricingLoading={isPricingLoading}
        bookingType={bookingType}
      />
      {!preview && pricingError ? <FormError errors={[pricingError]} /> : null}
      {showErrors ? <FormError id={errorId} errors={bookingErrors} /> : null}
    </>
  );
}

export function CarBookingCheckout({
  price,
  schedule,
  tripArrivalTime,
  tripDuration,
  bookingType,
  checkout,
}: {
  readonly price: ReactNode;
  readonly schedule: ReactNode;
  readonly tripArrivalTime: string | null;
  readonly tripDuration: TripDurationResponse | null;
  readonly bookingType: BookingType;
  readonly checkout: CheckoutState;
}) {
  const checkoutProps = {
    tripArrivalTime,
    tripDuration,
    preview: checkout.preview,
    pricingError: checkout.pricingError,
    isPricingLoading: checkout.isPricingLoading,
    bookingType,
    bookingErrors: checkout.bookingErrors,
  };
  const isAirportPickup = bookingType === AIRPORT_PICKUP_BOOKING_TYPE;

  return (
    <>
      <div className={bookingCardShellClassName}>
        <div className="lg:pb-6">
          <Card className={bookingCardInnerClassName}>
            {price}
            <CardContent className={`${bookingCardContentClassName} lg:pb-0`}>
              {schedule}
            </CardContent>
          </Card>
          {checkout.guest ? (
            <div className="mt-4 lg:px-6">
              <h3 className="mb-2 text-sm font-semibold lg:hidden">Guest Details</h3>
              {checkout.guest}
            </div>
          ) : null}
        </div>
        <CardFooter className="hidden flex-col items-stretch gap-4 border-t bg-gray-50 p-4 lg:flex">
          <CarBookingCheckoutSummary
            {...checkoutProps}
            errorId={`${checkout.errorId}-desktop`}
            showErrors
          />
          <CarBookingPayActions
            isPaying={checkout.isPaying}
            isSignedIn={checkout.isSignedIn}
            signInHref={checkout.signInHref}
            canPay={checkout.canPay}
          />
        </CardFooter>
      </div>
      <div
        className={cn(
          "mt-4 space-y-4 lg:hidden",
          mobileCheckoutPadding(checkout.isSignedIn, isAirportPickup),
        )}
      >
        <CarBookingCheckoutSummary {...checkoutProps} />
      </div>
      <CarBookingMobilePayBar
        preview={checkout.preview}
        isPricingLoading={checkout.isPricingLoading}
        isPaying={checkout.isPaying}
        isSignedIn={checkout.isSignedIn}
        signInHref={checkout.signInHref}
        errorId={`${checkout.errorId}-mobile`}
        bookingErrors={checkout.bookingErrors}
        canPay={checkout.canPay}
      />
    </>
  );
}
