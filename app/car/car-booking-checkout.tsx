import { ChevronDown, Loader2 } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { Link } from "react-router";
import type { TripDurationResponse } from "~/api/flights/schema";
import { BookingCostBreakdown, BookingOrderTotal } from "~/booking/booking-cost-breakdown";
import type { BookingCostDisplay } from "~/booking/booking-estimate";
import { TripDetails } from "~/booking/trip-details";
import type { BookingType } from "~/booking/types";
import { FormError } from "~/components/forms/form-primitives";
import { Button } from "~/components/ui/button";
import { useElementHeight } from "~/hooks/use-element-height";

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
    <div className="flex w-full flex-col gap-6 lg:gap-2">
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
        <div className="flex items-center justify-center text-sm leading-5 lg:leading-normal">
          <span className="text-gray-500 lg:text-inherit">Have an account?</span>
          <Link
            to={signInHref}
            className="px-1 font-medium text-neutral-950 underline lg:inline-flex lg:h-10 lg:items-center lg:text-inherit"
          >
            Sign in to book
          </Link>
        </div>
      )}
    </div>
  );
}

function BookServiceSection({
  open,
  onOpenChange,
  price,
  schedule,
  guest,
  phone,
  addons,
  tripArrivalTime,
  tripDuration,
  tripDurationError,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly price: ReactNode;
  readonly schedule: ReactNode;
  readonly guest: ReactNode;
  readonly phone: ReactNode;
  readonly addons: ReactNode;
  readonly tripArrivalTime: string | null;
  readonly tripDuration: TripDurationResponse | null;
  readonly tripDurationError: string | null;
}) {
  const panelId = useId();

  return (
    <section className={serviceCardClassName}>
      <h2>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 rounded-md text-left text-base font-semibold leading-5 text-gray-900 hover:text-gray-700 focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => onOpenChange(!open)}
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
        ) : tripDurationError ? (
          <FormError errors={[tripDurationError]} />
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
  tripDurationError,
  bookingType,
  checkout,
}: {
  readonly price: ReactNode;
  readonly schedule: ReactNode;
  readonly tripArrivalTime: string | null;
  readonly tripDuration: TripDurationResponse | null;
  readonly tripDurationError: string | null;
  readonly bookingType: BookingType;
  readonly checkout: CheckoutState;
}) {
  const [serviceOpen, setServiceOpen] = useState(true);
  const orderTotal = useElementHeight<HTMLElement>();

  return (
    <div className="flex flex-col gap-4">
      <BookServiceSection
        open={serviceOpen}
        onOpenChange={setServiceOpen}
        price={price}
        schedule={schedule}
        guest={checkout.guest}
        phone={checkout.phone}
        addons={checkout.addons}
        tripArrivalTime={tripArrivalTime}
        tripDuration={tripDuration}
        tripDurationError={tripDurationError}
      />
      {checkout.credits}
      <div className="-mx-4 bg-gray-100 lg:mx-0 lg:rounded-lg lg:border lg:border-gray-200 lg:px-6 lg:py-6 lg:shadow-[0_8px_50px_rgba(0,0,0,0.07)]">
        <div className="px-4 py-4 lg:px-0 lg:py-0">
          <BookingCostBreakdown cost={checkout.cost} bookingType={bookingType} />
          <div className="mt-6 hidden space-y-6 lg:block">
            {checkout.pricingError ? <FormError errors={[checkout.pricingError]} /> : null}
            <FormError id={`${checkout.errorId}-desktop`} errors={checkout.bookingErrors} />
            <CarBookingPayActions
              isPaying={checkout.isPaying}
              isSignedIn={checkout.isSignedIn}
              signInHref={checkout.signInHref}
              canPay={checkout.canPay}
            />
          </div>
        </div>
        <div
          className="lg:hidden"
          style={{ height: serviceOpen ? orderTotal.height : 0 }}
          aria-hidden="true"
        />
        <section
          ref={orderTotal.ref}
          className={`${serviceOpen ? "fixed inset-x-0 bottom-0 z-50 max-h-[100dvh] overflow-y-auto shadow-[0_8px_50px_rgba(0,0,0,0.07)]" : "relative"} flex flex-col gap-6 border-t border-gray-200 bg-gray-100 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:hidden`}
        >
          <BookingOrderTotal cost={checkout.cost} />
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
    </div>
  );
}
