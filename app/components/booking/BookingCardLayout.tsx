import { getFormProps } from "@conform-to/react";
import { Tag } from "lucide-react";
import { Link } from "react-router";
import { Form } from "~/components/CSRFForm";
import type { BookingCardViewModel } from "~/hooks/useBookingCard";
import { cn, formatCurrency } from "~/lib/utils";
import { BookingTypeTabs } from "../BookingTypeTabs";
import {
  AIRPORT_PICKUP_BOOKING_TYPE,
  BOOKING_TYPE_LABELS,
  BOOKING_TYPE_OPTIONS_MAP,
  FULL_DAY_BOOKING_TYPE,
  NIGHT_BOOKING_TYPE,
} from "../bookingTypes";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Label } from "../ui/label";
import { BookingAddons } from "./BookingAddons";
import { BookingCostBreakdown } from "./BookingCostBreakdown";
import { BookingFormFields } from "./BookingFormFields";
import { BookingActionsPlacement, GuestDetailsPlacement } from "./BookingCardPlacements";
import { PromoBookingTotal } from "./PromoBookingTotal";
import { SingleDatePicker } from "./SingleDatePicker";
import { TripDetails } from "./TripDetails";

export function BookingCardLayout(vm: Readonly<BookingCardViewModel>) {
  const {
    ERROR_RING_CLASSES,
    baseTotal,
    bookingCredits,
    bookingFetcher,
    bookingType,
    car,
    carIsAvailableToBook,
    currentCarPrice,
    dateRange,
    effectiveHeaderUnitPrice,
    fallbackDateRef,
    fields,
    finalTotalCost,
    form,
    fuelNote,
    fuelUpgradeCost,
    guestFields,
    handleBookingTypeChange,
    handleFromDateChange,
    handleFullTankChange,
    handleNavigateToAuth,
    handleAddressUpdate,
    handlePickupTimeChange,
    handleSameLocationChange,
    handleToDateChange,
    hasAnyPromoDiscount,
    hasValidBookingType,
    isAvailable,
    isPending,
    listRate,
    listRateForBookingType,
    nightBookingHelperText,
    originalRates,
    partnerSlug,
    platformFee,
    platformServiceFeeRate,
    promoCompare,
    promotion,
    promotionPricingPreview,
    referralDiscountAmount,
    requiresFullTank,
    sameLocationChecked,
    setValidatedFlight,
    shouldHighlightHeaderRate,
    shouldShowHeaderPromoStrike,
    showFetcherError,
    subtotalBeforeDiscounts,
    toDateMinDate,
    totalDays,
    tripDetailsArrivalTime,
    tripDuration,
    useCreditsAmount,
    user,
    handleUseCreditsChange,
    validatedFlight,
    vat,
    vatRate,
  } = vm;

  return (
    <Form {...getFormProps(form)} method="POST" autoComplete="off">
      <input type="hidden" name="carId" value={car.id} />
      <input type="hidden" name="totalAmount" value={finalTotalCost} />
      <input type="hidden" name="requiresFullTank" value={String(requiresFullTank)} />
      <input type="hidden" name="useCredits" value={useCreditsAmount} />
      {partnerSlug ? <input type="hidden" name="partnerSlug" value={partnerSlug} /> : null}

      <Card className="rounded shadow-xl inset-shadow-sm transform-gpu">
        <CardHeader className="px-4 lg:px-6 py-4">
          <CardTitle>
            <span className="text-lg" aria-live="polite">
              {shouldShowHeaderPromoStrike && originalRates && (
                <span className="text-gray-400 line-through mr-1.5">
                  {formatCurrency(listRate ?? listRateForBookingType(bookingType, originalRates))}
                </span>
              )}
              <span className={shouldHighlightHeaderRate ? "text-red-600" : ""}>
                {formatCurrency(effectiveHeaderUnitPrice)}
              </span>

              <span className="text-sm text-gray-500 font-normal">
                {" "}
                per {BOOKING_TYPE_LABELS[bookingType].perUnit}
              </span>

              {hasAnyPromoDiscount && promotion && (
                <span className="ml-2 inline-flex align-middle items-center gap-1 px-2 py-1.5 bg-red-500/95 rounded-full shadow-md">
                  <Tag className="h-3 w-3 text-white shrink-0" aria-hidden />
                  <span className="text-xs font-semibold text-white leading-none">
                    {promotion.label || "SALE"}
                  </span>
                </span>
              )}
            </span>
          </CardTitle>
        </CardHeader>

        {hasValidBookingType ? (
          <CardContent className="space-y-4 [&>div:first-of-type]:!mt-0 px-4 lg:px-6">
            <input type="hidden" name="bookingType" value={bookingType} />

            <div className="space-y-1">
              <Label className="font-semibold">Booking Type</Label>
              <BookingTypeTabs
                value={BOOKING_TYPE_OPTIONS_MAP[bookingType].value}
                onValueChange={handleBookingTypeChange}
                variant="modal"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor={`${form.id}-daterange`} className="font-semibold">
                Select Dates
              </Label>
              {bookingType === AIRPORT_PICKUP_BOOKING_TYPE ? (
                <SingleDatePicker
                  isAirportPickup={bookingType === AIRPORT_PICKUP_BOOKING_TYPE}
                  date={dateRange.from}
                  onDateChange={handleFromDateChange}
                  showLabel={false}
                />
              ) : (
                <div className="flex gap-2">
                  <SingleDatePicker
                    className="flex-1"
                    isNightBooking={bookingType === NIGHT_BOOKING_TYPE}
                    isFullDayBooking={bookingType === FULL_DAY_BOOKING_TYPE}
                    date={dateRange.from}
                    onDateChange={handleFromDateChange}
                    showLabel={false}
                    placeholder="From date"
                  />
                  <SingleDatePicker
                    className="flex-1"
                    isNightBooking={bookingType === NIGHT_BOOKING_TYPE}
                    isFullDayBooking={bookingType === FULL_DAY_BOOKING_TYPE}
                    date={dateRange.to}
                    onDateChange={handleToDateChange}
                    showLabel={false}
                    placeholder="To date"
                    minDate={toDateMinDate}
                    disabled={!dateRange.from}
                  />
                </div>
              )}
            </div>
            {totalDays > 0 && !isAvailable && (
              <div className="text-red-600 p-2 bg-red-50 border border-red-200 rounded-md text-sm text-center">
                Car not available for the selected date.
              </div>
            )}
            {carIsAvailableToBook && (
              <div className="w-full space-y-4">
                <BookingFormFields
                  bookingType={bookingType}
                  dateRange={dateRange}
                  fallbackDate={fallbackDateRef.current}
                  fields={{
                    pickupTime: fields.pickupTime,
                    flightNumber: fields.flightNumber,
                    pickupAddress: fields.pickupAddress,
                    dropOffAddress: fields.dropOffAddress,
                    sameLocation: fields.sameLocation,
                  }}
                  sameLocationChecked={sameLocationChecked}
                  formId={form.id}
                  errorRingClasses={ERROR_RING_CLASSES}
                  nightBookingHelperText={nightBookingHelperText}
                  onPickupTimeChange={handlePickupTimeChange}
                  onSameLocationChange={handleSameLocationChange}
                  onAddressUpdate={handleAddressUpdate}
                  validatedFlight={validatedFlight}
                  onFlightValidated={setValidatedFlight}
                />

                {/* Guest Details - Desktop only (mobile version is outside Card) */}
                <GuestDetailsPlacement
                  guestFields={guestFields}
                  errorRingClasses={ERROR_RING_CLASSES}
                  className="hidden lg:block"
                  variant="desktop"
                />

                <BookingAddons
                  bookingType={bookingType}
                  totalDays={totalDays}
                  fuelNote={fuelNote}
                  fuelUpgradeRate={car.fuelUpgradeRate ?? 0}
                  requiresFullTank={requiresFullTank}
                  onFullTankChange={handleFullTankChange}
                  user={user}
                  bookingCredits={bookingCredits}
                  useCreditsAmount={useCreditsAmount}
                  subtotalBeforeDiscounts={subtotalBeforeDiscounts}
                  referralDiscountAmount={referralDiscountAmount}
                  onUseCreditsChange={handleUseCreditsChange}
                  pricingIncludesFuel={car.pricingIncludesFuel}
                />
              </div>
            )}
          </CardContent>
        ) : (
          <CardContent className="space-y-4">
            <div className="text-red-600 p-4 bg-red-50 border border-red-200 rounded-md text-sm text-center">
              <p className="font-medium mb-2">Invalid booking type</p>
              <p>
                Please{" "}
                <Link to="/" className="underline font-medium hover:text-red-800">
                  select a car from the home page
                </Link>{" "}
                to continue.
              </p>
            </div>
          </CardContent>
        )}

        {hasValidBookingType && carIsAvailableToBook && (
          <CardFooter className="hidden lg:flex flex-col items-stretch space-y-4 bg-gray-50 p-4 border-t">
            {/* Show trip duration for airport pickup bookings */}
            {bookingType === AIRPORT_PICKUP_BOOKING_TYPE &&
              tripDetailsArrivalTime &&
              tripDuration && (
                <TripDetails
                  estimatedArrival={tripDetailsArrivalTime}
                  durationInMinutes={tripDuration.durationInMinutes}
                  distanceText={tripDuration.distanceText}
                  status={tripDuration.status}
                />
              )}

            <BookingCostBreakdown
              currentCarPrice={currentCarPrice}
              totalDays={totalDays}
              bookingType={bookingType}
              baseTotal={baseTotal}
              fuelUpgradeCost={fuelUpgradeCost}
              platformFee={platformFee}
              platformServiceFeeRate={platformServiceFeeRate}
              referralDiscountAmount={referralDiscountAmount}
              useCreditsAmount={useCreditsAmount}
              vatRate={vatRate}
              vat={vat}
              finalTotalCost={finalTotalCost}
              pricingIncludesFuel={car.pricingIncludesFuel}
              promotionPricingSegments={promotionPricingPreview?.segments ?? null}
              promoCompare={promoCompare}
            />

            {/* Display booking submission errors */}
            {showFetcherError && bookingFetcher.data?.error && (
              <div className="bg-red-50 border-l-4 border-red-400 text-red-800 p-3 text-sm">
                {bookingFetcher.data.error}
              </div>
            )}

            <BookingActionsPlacement
              user={user}
              isPending={isPending}
              onNavigateToAuth={handleNavigateToAuth}
            />
          </CardFooter>
        )}
      </Card>

      {/* Mobile only: Cost breakdown in its own bordered section - OUTSIDE Card */}
      {hasValidBookingType && carIsAvailableToBook && (
        <div
          className={cn(
            "lg:hidden mt-4 pb-40",
            !user && bookingType === AIRPORT_PICKUP_BOOKING_TYPE && "pb-52",
            !user && bookingType !== AIRPORT_PICKUP_BOOKING_TYPE && "pb-48",
          )}
        >
          <div className="space-y-4">
            {/* Guest Details - Mobile only */}
            <GuestDetailsPlacement
              guestFields={guestFields}
              errorRingClasses={ERROR_RING_CLASSES}
              className="w-full lg:hidden"
              showHeading
              variant="mobile"
            />

            {/* Trip details for airport pickup */}
            {bookingType === AIRPORT_PICKUP_BOOKING_TYPE &&
              tripDetailsArrivalTime &&
              tripDuration && (
                <TripDetails
                  estimatedArrival={tripDetailsArrivalTime}
                  durationInMinutes={tripDuration.durationInMinutes}
                  distanceText={tripDuration.distanceText}
                  status={tripDuration.status}
                />
              )}

            <BookingCostBreakdown
              currentCarPrice={currentCarPrice}
              totalDays={totalDays}
              bookingType={bookingType}
              baseTotal={baseTotal}
              fuelUpgradeCost={fuelUpgradeCost}
              platformFee={platformFee}
              platformServiceFeeRate={platformServiceFeeRate}
              referralDiscountAmount={referralDiscountAmount}
              useCreditsAmount={useCreditsAmount}
              vatRate={vatRate}
              vat={vat}
              finalTotalCost={finalTotalCost}
              pricingIncludesFuel={car.pricingIncludesFuel}
              promotionPricingSegments={promotionPricingPreview?.segments ?? null}
              promoCompare={promoCompare}
            />

            {/* Display booking submission errors */}
            {showFetcherError && bookingFetcher.data?.error && (
              <div className="bg-red-50 border-l-4 border-red-400 text-red-800 p-3 text-sm">
                {bookingFetcher.data.error}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile: Sticky footer with just total and pay button - OUTSIDE Card */}
      {hasValidBookingType && carIsAvailableToBook && (
        <div className="lg:hidden fixed bottom-0 rounded-t-xl left-0 right-0 z-50 bg-white border-t shadow-[0_-4px_20px_rgba(0,0,0,0.1)] pb-[env(safe-area-inset-bottom)]">
          {/* Display booking submission errors */}
          {showFetcherError && bookingFetcher.data?.error && (
            <div className="px-4 py-2 bg-red-50 border-b border-red-200">
              <p className="text-red-800 text-sm">{bookingFetcher.data.error}</p>
            </div>
          )}

          <div className="p-4 space-y-3">
            {/* Total row */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-gray-600">Total</span>
              <div className="text-right">
                <PromoBookingTotal
                  promoCompare={promoCompare}
                  finalTotalCost={finalTotalCost}
                  variant="mobile"
                />
              </div>
            </div>

            <BookingActionsPlacement
              user={user}
              isPending={isPending}
              onNavigateToAuth={handleNavigateToAuth}
            />
          </div>
        </div>
      )}
    </Form>
  );
}
