import { ChevronDown, Loader2 } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { Link } from "react-router";
import type { TripDurationResponse } from "~/api/flights/schema";
import { BookingCostBreakdown } from "~/booking/booking-cost-breakdown";
import type { BookingCostDisplay } from "~/booking/booking-estimate";
import { TripDetails } from "~/booking/trip-details";
import type { BookingType } from "~/booking/types";
import { FormError } from "~/components/forms/form-primitives";
import { Button } from "~/components/ui/button";

const serviceCardClassName =
  "rounded-lg border border-gray-200 bg-white px-4 py-6 shadow-[0_4px_20px_rgba(0,0,0,0.07)] lg:px-6";

interface CheckoutState {
  readonly guest: ReactNode;
  readonly phone: ReactNode;
  readonly addons: ReactNode;
  readonly credits: ReactNode;
  readonly cost: BookingCostDisplay;
  readonly pricingError: string | null;
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
  return (
    <div className="flex flex-col gap-2">
      <Button
        type="submit"
        className="h-12 w-full rounded-md bg-neutral-950 px-4 text-white hover:bg-neutral-800 disabled:bg-neutral-500 disabled:opacity-100"
        disabled={isPaying || !canPay}
        aria-busy={isPaying}
      >
        {isPaying ? (
          <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        ) : (
          "Pay Now"
        )}
      </Button>
      {isSignedIn ? null : (
        <div className="flex items-center justify-center text-sm">
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

function BookServiceSection({
  price,
  schedule,
  guest,
  phone,
  addons,
  tripArrivalTime,
  tripDuration,
}: {
  readonly price: ReactNode;
  readonly schedule: ReactNode;
  readonly guest: ReactNode;
  readonly phone: ReactNode;
  readonly addons: ReactNode;
  readonly tripArrivalTime: string | null;
  readonly tripDuration: TripDurationResponse | null;
}) {
  const [open, setOpen] = useState(true);
  const panelId = useId();

  return (
    <section className={serviceCardClassName}>
      <h2>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 rounded-md text-left text-base font-semibold leading-5 text-gray-900 hover:text-gray-700 focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((current) => !current)}
        >
          Book a service
          <ChevronDown
            aria-hidden="true"
            className={`size-4 shrink-0 text-gray-900 transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
          />
        </button>
      </h2>
      <div
        id={panelId}
        className={`mt-4 flex-col gap-6 border-t border-gray-200 pt-6 ${open ? "flex" : "hidden"}`}
      >
        <div className="hidden lg:block">{price}</div>
        {schedule}
        {guest}
        {phone}
        {addons}
        {tripArrivalTime && tripDuration ? (
          <TripDetails arrivalTime={tripArrivalTime} duration={tripDuration} />
        ) : null}
      </div>
    </section>
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
  return (
    <div className="flex flex-col gap-4">
      <BookServiceSection
        price={price}
        schedule={schedule}
        guest={checkout.guest}
        phone={checkout.phone}
        addons={checkout.addons}
        tripArrivalTime={tripArrivalTime}
        tripDuration={tripDuration}
      />
      {checkout.credits}
      <section className="-mx-4 mt-4 space-y-6 border-t border-gray-200 bg-gray-100 px-4 py-4 shadow-[0_8px_50px_rgba(0,0,0,0.07)] lg:mx-0 lg:mt-0 lg:rounded-lg lg:border lg:px-6 lg:py-6">
        <BookingCostBreakdown cost={checkout.cost} bookingType={bookingType} />
        {checkout.pricingError ? <FormError errors={[checkout.pricingError]} /> : null}
        <FormError id={checkout.errorId} errors={checkout.bookingErrors} />
        <CarBookingPayActions
          isPaying={checkout.isPaying}
          isSignedIn={checkout.isSignedIn}
          signInHref={checkout.signInHref}
          canPay={checkout.canPay}
        />
      </section>
    </div>
  );
}
