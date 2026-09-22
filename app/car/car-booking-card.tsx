import type { SubmissionResult } from "@conform-to/react";
import { Tag } from "lucide-react";
import { useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";

import type { PublicAddon } from "~/api/addons/schema";
import type { BookingPricingPreview } from "~/api/bookings/schema";
import type { PublicCarDetail } from "~/api/cars/schema";
import type { PublicRates } from "~/api/rates/schema";
import { usePublicUser } from "~/auth/use-public-user";
import { composeAirportPickupAddress } from "~/booking/airport-pickup";
import { BookingCreditsControl } from "~/booking/booking-credits-control";
import {
  estimateBookingCost,
  overlayBookingCostPreview,
  pricingPreviewForSelection,
  resolvePlatformFeeRate,
  resolveVatRate,
} from "~/booking/booking-estimate";
import { nextToDateOnFromChange } from "~/booking/dates";
import { AIRPORT_PICKUP_BOOKING_TYPE } from "~/booking/types";
import { useBookingCredits } from "~/booking/use-booking-credits";
import { CarBookingPayForm } from "~/car/car-booking-pay-form";
import { CarBookingScheduleFields } from "~/car/car-booking-schedule-fields";
import { buildCurrentCarDetailSearchPath, parseCarDetailUrl } from "~/car/car-url";
import { useCarBookingCard } from "~/car/use-car-booking-card";
import { CardHeader, CardTitle } from "~/components/ui/card";
import { useAirportPickup } from "~/hooks/use-airport-pickup";
import { useBookingPricingPreview } from "~/hooks/use-booking-pricing-preview";
import { formatZonedDate, parseZonedCalendarDate } from "~/time/timezone";

interface CarBookingCardProps {
  readonly car: PublicCarDetail;
  readonly rates: PublicRates;
  readonly addons: PublicAddon[];
  readonly lastResult?: SubmissionResult<string[]>;
  readonly currentPricing?: BookingPricingPreview;
  readonly currentPricingSelectionKey?: string;
  readonly previewReferralCredit?: {
    readonly availableCredits: number;
    readonly creditLimit: number;
  };
}

function parseOptionalCalendarDate(value: string | null | undefined) {
  return value ? parseZonedCalendarDate(value) : undefined;
}

function formatOptionalCalendarDate(value: Date | undefined) {
  return value ? formatZonedDate(value) : "";
}

function pricingPreviewInput(
  carId: string,
  card: ReturnType<typeof useCarBookingCard>,
  actionPreview: BookingPricingPreview | undefined,
  addonIds: readonly string[],
  useCredits: number,
) {
  if (!card.hasCompleteDates || actionPreview) {
    return null;
  }

  return {
    carId,
    bookingType: card.bookingType,
    from: formatOptionalCalendarDate(card.fromDate),
    to: formatOptionalCalendarDate(card.toDate),
    pickupTime: card.pickupTime ?? "",
    addonIds,
    useCredits,
  };
}

function CarBookingCardPrice({
  showPromoPrice,
  listRateLabel,
  displayRateLabel,
  rateLabel,
  hasPromotion,
  promotionLabel,
}: {
  readonly showPromoPrice: boolean;
  readonly listRateLabel: string;
  readonly displayRateLabel: string;
  readonly rateLabel: string;
  readonly hasPromotion: boolean;
  readonly promotionLabel: string | null;
}) {
  return (
    <CardHeader className="px-4 py-4 lg:px-6">
      <CardTitle className="font-semibold leading-none tracking-tight">
        <span className="text-lg" aria-live="polite">
          {showPromoPrice ? (
            <span className="mr-1.5 text-gray-400 line-through">{listRateLabel}</span>
          ) : null}
          <span className={showPromoPrice ? "text-red-600" : ""}>{displayRateLabel}</span>
          <span className="text-sm font-normal text-gray-500">
            {" "}
            {rateLabel.replace("/", "per")}
          </span>
          {hasPromotion && promotionLabel ? (
            <span className="ml-2 inline-flex items-center gap-1 align-middle rounded-full bg-red-500/95 px-2 py-1.5 shadow-md">
              <Tag aria-hidden="true" className="h-3 w-3 shrink-0 text-white" />
              <span className="text-xs font-semibold leading-none text-white">
                {promotionLabel}
              </span>
            </span>
          ) : null}
        </span>
      </CardTitle>
    </CardHeader>
  );
}

export function CarBookingCard({
  car,
  rates,
  addons,
  lastResult,
  currentPricing,
  currentPricingSelectionKey,
  previewReferralCredit,
}: CarBookingCardProps) {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const query = parseCarDetailUrl(searchParams);
  const addonCatalogKey = addons.map((addon) => addon.id).join("|");
  const [addonSelection, setAddonSelection] = useState({
    catalogKey: addonCatalogKey,
    ids: [] as string[],
  });
  const [previewCreditsEnabled, setPreviewCreditsEnabled] = useState(false);
  const selectedAddonIds = addonSelection.catalogKey === addonCatalogKey ? addonSelection.ids : [];
  const isSignedIn = usePublicUser() != null;
  const initialFromDate = parseOptionalCalendarDate(query.search.from);
  const parsedToDate = parseOptionalCalendarDate(query.search.to);
  const initialToDate = nextToDateOnFromChange(query.bookingType, initialFromDate, parsedToDate);
  const airportSearch =
    query.bookingType === AIRPORT_PICKUP_BOOKING_TYPE ? query.search : undefined;
  const airportPickup = useAirportPickup({
    flightNumber: airportSearch?.flightNumber,
    date: airportSearch?.from,
    onFlightFound: (flight) => {
      const latest = parseCarDetailUrl(new URLSearchParams(window.location.search));

      navigate(
        buildCurrentCarDetailSearchPath(window.location.pathname, {
          ...latest,
          pickupAddress: composeAirportPickupAddress(flight),
          sameLocation: false,
          search: {
            ...latest.search,
            flightNumber: flight.flightNumber,
          },
        }),
        {
          replace: true,
          preventScrollReset: true,
        },
      );
    },
  });
  const card = useCarBookingCard({
    car,
    pathname: location.pathname,
    query,
    initialFromDate,
    initialToDate,
    initialPickupTime: query.search.pickupTime ?? undefined,
    initialFlightNumber: query.search.flightNumber ?? "",
    searchFlight: airportPickup.searchFlight,
    resetFlight: airportPickup.resetFlight,
    calculateDuration: airportPickup.calculateDuration,
    resetDuration: airportPickup.resetDuration,
  });
  const matchedActionPreview = pricingPreviewForSelection(
    currentPricing,
    currentPricingSelectionKey,
    {
      bookingType: card.bookingType,
      from: formatOptionalCalendarDate(card.fromDate),
      to: formatOptionalCalendarDate(card.toDate),
      pickupTime: card.pickupTime ?? "",
      addonIds: selectedAddonIds,
    },
  );
  const bookingCredits = useBookingCredits(
    isSignedIn ? (matchedActionPreview?.creditsUsed ?? 0) : 0,
    isSignedIn,
  );
  const requestedCredits = bookingCredits.requestedCredits;
  const actionPreview =
    matchedActionPreview?.creditsUsed === requestedCredits ? matchedActionPreview : undefined;
  const pricing = useBookingPricingPreview(
    pricingPreviewInput(car.id, card, actionPreview, selectedAddonIds, requestedCredits),
  );
  const preview = actionPreview ?? pricing.preview;
  const applicableCreditsKey = [
    car.id,
    card.bookingType,
    formatOptionalCalendarDate(card.fromDate),
    formatOptionalCalendarDate(card.toDate),
    card.pickupTime ?? "",
    [...selectedAddonIds].sort().join(","),
  ].join("|");
  const [lastApplicableCredits, setLastApplicableCredits] = useState({
    key: "",
    amount: 0,
  });
  if (
    preview &&
    (lastApplicableCredits.key !== applicableCreditsKey ||
      lastApplicableCredits.amount !== preview.creditsApplicable)
  ) {
    setLastApplicableCredits({
      key: applicableCreditsKey,
      amount: preview.creditsApplicable,
    });
  }
  const thisBookingCredits = preview
    ? preview.creditsApplicable
    : pricing.isLoading && lastApplicableCredits.key === applicableCreditsKey
      ? lastApplicableCredits.amount
      : 0;
  const credits = previewReferralCredit ? (
    <BookingCreditsControl
      availableCredits={previewReferralCredit.availableCredits}
      creditLimit={previewReferralCredit.creditLimit}
      checked={previewCreditsEnabled}
      onCheckedChange={setPreviewCreditsEnabled}
    />
  ) : isSignedIn && bookingCredits.availableCredits > 0 && thisBookingCredits > 0 ? (
    <BookingCreditsControl
      availableCredits={bookingCredits.availableCredits}
      creditLimit={thisBookingCredits}
      checked={bookingCredits.enabled}
      onCheckedChange={bookingCredits.setCreditsEnabled}
    />
  ) : null;
  const estimate = estimateBookingCost({
    dayRate: car.dayRate,
    nightRate: car.nightRate,
    fullDayRate: car.fullDayRate,
    airportPickupRate: car.airportPickupRate,
    bookingType: card.bookingType,
    units: card.totalUnits,
    platformFeeRate: resolvePlatformFeeRate(rates.platformCustomerServiceFeeRatePercent),
    vatRate: resolveVatRate(rates.vatRatePercent),
    fuelUpgradeRate: car.fuelUpgradeRate ?? 0,
    pricingIncludesFuel: car.pricingIncludesFuel,
    promotion: car.promotion,
  });
  const price = (
    <CarBookingCardPrice
      showPromoPrice={card.view.showPromoPrice}
      listRateLabel={card.view.listRateLabel}
      displayRateLabel={card.view.displayRateLabel}
      rateLabel={card.view.rateLabel}
      hasPromotion={card.view.hasPromotion}
      promotionLabel={card.view.promotionLabel}
    />
  );
  const schedule = (
    <CarBookingScheduleFields
      card={card}
      flight={airportPickup.flight}
      flightError={airportPickup.flightError}
      flightWarning={airportPickup.flightWarning}
      isValidatingFlight={airportPickup.isValidatingFlight}
    />
  );

  return (
    <CarBookingPayForm
      carId={car.id}
      bookingType={card.bookingType}
      from={formatOptionalCalendarDate(card.fromDate)}
      to={formatOptionalCalendarDate(card.toDate)}
      pickupTime={card.pickupTime ?? ""}
      flightNumber={card.flightNumber}
      pickupAddress={card.pickupAddress}
      dropOffAddress={card.dropOffAddress}
      sameLocation={card.sameLocation}
      addons={addons}
      selectedAddonIds={selectedAddonIds}
      useCredits={requestedCredits}
      onAddonSelectionChange={(addonId, selected) => {
        setAddonSelection((current) => {
          const ids = current.catalogKey === addonCatalogKey ? current.ids : [];

          return {
            catalogKey: addonCatalogKey,
            ids: selected ? [...ids, addonId] : ids.filter((id) => id !== addonId),
          };
        });
      }}
      cost={overlayBookingCostPreview(estimate, preview)}
      preview={preview}
      pricingError={bookingCredits.error ?? (actionPreview ? null : pricing.error)}
      isPricingLoading={(actionPreview ? false : pricing.isLoading) || bookingCredits.isLoading}
      lastResult={lastResult}
      price={price}
      schedule={schedule}
      credits={credits}
      tripArrivalTime={
        card.isAirportPickup && airportPickup.flight ? airportPickup.flight.arrivalTime : null
      }
      tripDuration={card.isAirportPickup ? airportPickup.tripDuration : null}
    />
  );
}
