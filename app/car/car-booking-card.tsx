import { Tag } from "lucide-react";
import { useId, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

import type { PublicCarDetail } from "~/api/cars/schema";
import {
  composeAirportPickupAddress,
  isCompleteFlightNumber,
  nightBookingHelperText,
} from "~/booking/airport-pickup";
import { BookingFlightField } from "~/booking/booking-flight-field";
import { BookingLocationFields } from "~/booking/booking-location-fields";
import { BookingTimeSelect } from "~/booking/booking-time-select";
import { BookingTypeTabs } from "~/booking/booking-type-tabs";
import {
  calculateBookingUnits,
  getToDateMinDate,
  hasCompleteBookingDates,
  isValidToDateSelection,
  nextToDateOnFromChange,
} from "~/booking/dates";
import { nextPickupTimeOnFromChange } from "~/booking/pickup";
import { SingleDatePicker } from "~/booking/single-date-picker";
import { TripDetails } from "~/booking/trip-details";
import { AIRPORT_PICKUP_BOOKING_TYPE, type BookingType, NIGHT_BOOKING_TYPE } from "~/booking/types";
import { CarDomain, formatNaira } from "~/car/car-domain";
import {
  buildBookingTypeCarPath,
  buildCarDetailSearchPath,
  type CarDetailUrlQuery,
  parseCarDetailUrl,
} from "~/car/car-url";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { useAirportPickup } from "~/hooks/use-airport-pickup";
import { formatZonedDate, parseZonedCalendarDate } from "~/time/timezone";

interface CarBookingCardProps {
  readonly car: PublicCarDetail;
}

interface CarBookingCardFieldsProps {
  readonly car: PublicCarDetail;
  readonly query: CarDetailUrlQuery;
  readonly initialFromDate: Date | undefined;
  readonly initialToDate: Date | undefined;
  readonly initialPickupTime: string | undefined;
  readonly initialFlightNumber: string;
  readonly airportPickup: ReturnType<typeof useAirportPickup>;
}

function CarBookingCardFields({
  car,
  query,
  initialFromDate,
  initialToDate,
  initialPickupTime,
  initialFlightNumber,
  airportPickup,
}: CarBookingCardFieldsProps) {
  const navigate = useNavigate();
  const pickupTimeId = useId();
  const flightNumberId = useId();
  const pickupAddressId = useId();
  const dropOffAddressId = useId();
  const sameLocationId = useId();
  const [fromDate, setFromDate] = useState(initialFromDate);
  const [toDate, setToDate] = useState(initialToDate);
  const [pickupTime, setPickupTime] = useState(initialPickupTime);
  const [flightNumber, setFlightNumber] = useState(initialFlightNumber);
  const pickupAddress = query.pickupAddress ?? "";
  const dropOffAddress = query.dropOffAddress ?? "";
  const sameLocation = query.sameLocation;
  const [fallbackDate] = useState(() => new Date());
  const bookingType = query.bookingType;
  const isAirportPickup = bookingType === AIRPORT_PICKUP_BOOKING_TYPE;
  const view = CarDomain(car, new Date(), bookingType);
  const hasCompleteDates = hasCompleteBookingDates(bookingType, fromDate, toDate);
  const totalUnits = calculateBookingUnits(
    fromDate ? formatZonedDate(fromDate) : null,
    toDate ? formatZonedDate(toDate) : null,
    bookingType,
  );
  const displayTotal = hasCompleteDates ? view.displayRate * totalUnits : undefined;
  const nightHelper = nightBookingHelperText(bookingType, totalUnits);
  const showDropOff = hasCompleteDates && (isAirportPickup || !sameLocation);
  const pickupIsReadOnly = isAirportPickup && pickupAddress.length > 0;

  const commitQuery = (next: CarDetailUrlQuery) => {
    navigate(buildCarDetailSearchPath(car, next), {
      replace: true,
      preventScrollReset: true,
    });
  };

  const nextQuery = (overrides: {
    readonly from?: string | null;
    readonly to?: string | null;
    readonly pickupTime?: string | null;
    readonly flightNumber?: string | null;
    readonly pickupAddress?: string | null;
    readonly dropOffAddress?: string | null;
    readonly sameLocation?: boolean;
  }): CarDetailUrlQuery => ({
    ...query,
    sameLocation: overrides.sameLocation ?? sameLocation,
    pickupAddress:
      overrides.pickupAddress !== undefined ? overrides.pickupAddress : query.pickupAddress,
    dropOffAddress:
      overrides.dropOffAddress !== undefined ? overrides.dropOffAddress : query.dropOffAddress,
    search: {
      ...query.search,
      bookingType,
      from: overrides.from !== undefined ? overrides.from : query.search.from,
      to: overrides.to !== undefined ? overrides.to : query.search.to,
      pickupTime:
        overrides.pickupTime !== undefined ? overrides.pickupTime : query.search.pickupTime,
      flightNumber:
        overrides.flightNumber !== undefined ? overrides.flightNumber : query.search.flightNumber,
    },
  });

  const commitBookingFields = (overrides: {
    readonly from?: string | null;
    readonly to?: string | null;
    readonly pickupTime?: string | null;
    readonly flightNumber?: string | null;
    readonly pickupAddress?: string | null;
    readonly dropOffAddress?: string | null;
    readonly sameLocation?: boolean;
  }) => {
    commitQuery(
      nextQuery({
        flightNumber: flightNumber || null,
        ...overrides,
      }),
    );
  };

  const handleBookingTypeChange = (nextBookingType: BookingType) => {
    navigate(buildBookingTypeCarPath(car, nextBookingType, query), {
      replace: true,
      preventScrollReset: true,
    });
  };

  const handleFromDateChange = (date: Date | undefined) => {
    const nextTo = nextToDateOnFromChange(bookingType, date, toDate);
    const nextPickup = nextPickupTimeOnFromChange({
      bookingType,
      fromDate: date,
      currentPickupTime: pickupTime,
      fallbackDate,
    });

    setFromDate(date);
    setToDate(nextTo);
    setPickupTime(nextPickup);

    const shouldLookupFlight =
      isAirportPickup && Boolean(date && isCompleteFlightNumber(flightNumber));

    commitBookingFields({
      from: date ? formatZonedDate(date) : null,
      to: nextTo ? formatZonedDate(nextTo) : null,
      pickupTime: bookingType === NIGHT_BOOKING_TYPE ? "11 PM" : (nextPickup ?? null),
      pickupAddress: isAirportPickup && !shouldLookupFlight ? null : undefined,
    });

    if (shouldLookupFlight && date) {
      airportPickup.searchFlight(flightNumber, formatZonedDate(date));
      return;
    }

    if (isAirportPickup) {
      airportPickup.resetFlight();
      airportPickup.resetDuration();
    }
  };

  const handleToDateChange = (date: Date | undefined) => {
    if (!isValidToDateSelection(bookingType, fromDate, date)) {
      return;
    }

    setToDate(date);
    commitBookingFields({ to: date ? formatZonedDate(date) : null });
  };

  const handlePickupTimeChange = (value: string | undefined) => {
    setPickupTime(value);
    commitBookingFields({ pickupTime: value ?? null });
  };

  const handleFlightBlur = (value: string) => {
    setFlightNumber(value);

    if (!value || !fromDate || !isCompleteFlightNumber(value)) {
      airportPickup.resetFlight();
      airportPickup.resetDuration();
      commitBookingFields({
        flightNumber: value || null,
        pickupAddress: null,
      });
      return;
    }

    commitBookingFields({ flightNumber: value });
    airportPickup.searchFlight(value, formatZonedDate(fromDate));
  };

  const handlePickupAddressSelect = (address: string) => {
    commitBookingFields({ pickupAddress: address || null });
  };

  const handleDropOffAddressSelect = (address: string) => {
    commitBookingFields({ dropOffAddress: address || null, sameLocation: false });

    if (!isAirportPickup || !address) {
      airportPickup.resetDuration();
      return;
    }

    airportPickup.calculateDuration(address);
  };

  const handleSameLocationChange = (checked: boolean) => {
    if (checked) {
      airportPickup.resetDuration();
      commitBookingFields({ sameLocation: true, dropOffAddress: null });
      return;
    }

    commitBookingFields({ sameLocation: false });
  };

  return (
    <Card className="gap-0 overflow-visible rounded border py-0 shadow-xl ring-0 transform-gpu">
      <CardHeader className="px-4 lg:px-6 py-4">
        <CardTitle className="font-semibold leading-none tracking-tight">
          <span className="text-lg" aria-live="polite">
            {view.showPromoPrice ? (
              <span className="text-gray-400 line-through mr-1.5">{view.listRateLabel}</span>
            ) : null}
            <span className={view.showPromoPrice ? "text-red-600" : ""}>
              {view.displayRateLabel}
            </span>
            <span className="text-sm text-gray-500 font-normal">
              {" "}
              {view.rateLabel.replace("/", "per")}
            </span>
            {view.hasPromotion && view.promotionLabel ? (
              <span className="ml-2 inline-flex align-middle items-center gap-1 px-2 py-1.5 bg-red-500/95 rounded-full shadow-md">
                <Tag aria-hidden="true" className="h-3 w-3 text-white shrink-0" />
                <span className="text-xs font-semibold text-white leading-none">
                  {view.promotionLabel}
                </span>
              </span>
            ) : null}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 [&>div:first-of-type]:mt-0 px-4 pb-6 lg:px-6">
        <div className="flex flex-col gap-2">
          <Label className="block font-semibold">Booking Type</Label>
          <BookingTypeTabs
            value={bookingType}
            onValueChange={handleBookingTypeChange}
            variant="modal"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label className="block font-semibold">
            {isAirportPickup ? "Select Date" : "Select Dates"}
          </Label>
          {isAirportPickup ? (
            <SingleDatePicker
              bookingType={bookingType}
              date={fromDate}
              onDateChange={handleFromDateChange}
              showLabel={false}
            />
          ) : (
            <div className="flex gap-2">
              <SingleDatePicker
                className="flex-1"
                bookingType={bookingType}
                date={fromDate}
                onDateChange={handleFromDateChange}
                showLabel={false}
                placeholder="From date"
              />
              <SingleDatePicker
                className="flex-1"
                bookingType={bookingType}
                date={toDate}
                onDateChange={handleToDateChange}
                minDate={getToDateMinDate(bookingType, fromDate)}
                showLabel={false}
                placeholder="To date"
                disabled={!fromDate}
              />
            </div>
          )}
        </div>

        {hasCompleteDates && isAirportPickup ? (
          <BookingFlightField
            id={flightNumberId}
            value={flightNumber}
            flight={airportPickup.flight}
            error={airportPickup.flightError}
            warning={airportPickup.flightWarning}
            isValidating={airportPickup.isValidatingFlight}
            onChange={(value) => {
              setFlightNumber(value);
              airportPickup.resetFlight();
            }}
            onBlur={handleFlightBlur}
          />
        ) : null}

        {hasCompleteDates && !isAirportPickup && bookingType !== NIGHT_BOOKING_TYPE ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor={pickupTimeId} className="block font-semibold">
              Pickup Time
            </Label>
            <BookingTimeSelect
              key={`${bookingType}-${fromDate?.toISOString()}`}
              id={pickupTimeId}
              date={fromDate ?? fallbackDate}
              bookingType={bookingType}
              value={pickupTime}
              onValueChange={handlePickupTimeChange}
            />
          </div>
        ) : null}

        {hasCompleteDates ? (
          <BookingLocationFields
            pickupAddressId={pickupAddressId}
            dropOffAddressId={dropOffAddressId}
            sameLocationId={sameLocationId}
            pickupAddress={pickupAddress}
            dropOffAddress={dropOffAddress}
            sameLocation={sameLocation}
            isAirportPickup={isAirportPickup}
            pickupIsReadOnly={pickupIsReadOnly}
            showDropOff={showDropOff}
            nightHelper={nightHelper}
            onPickupAddressSelect={handlePickupAddressSelect}
            onDropOffAddressSelect={handleDropOffAddressSelect}
            onSameLocationChange={handleSameLocationChange}
          />
        ) : null}

        {isAirportPickup && airportPickup.flight && airportPickup.tripDuration ? (
          <TripDetails
            arrivalTime={airportPickup.flight.arrivalTime}
            duration={airportPickup.tripDuration}
          />
        ) : null}

        {displayTotal ? (
          <p className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <span className="text-gray-600">Estimated total</span>
            <span className="font-semibold tabular-nums">{formatNaira(displayTotal)}</span>
          </p>
        ) : null}

        {hasCompleteDates ? (
          <p className="text-xs text-gray-600">
            {view.pricingIncludesFuel ? "Fuel included" : "Fuel is not included in this rate"}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function CarBookingCard({ car }: CarBookingCardProps) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = parseCarDetailUrl(searchParams);
  const initialFromDate = query.search.from ? parseZonedCalendarDate(query.search.from) : undefined;
  const parsedToDate = query.search.to ? parseZonedCalendarDate(query.search.to) : undefined;
  const initialToDate = nextToDateOnFromChange(query.bookingType, initialFromDate, parsedToDate);
  const resetKey = [
    query.bookingType,
    query.search.from,
    query.search.to,
    query.search.pickupTime,
    query.search.flightNumber,
  ].join("|");
  const airportPickup = useAirportPickup({
    onFlightFound: (flight) => {
      const latest = parseCarDetailUrl(new URLSearchParams(window.location.search));

      navigate(
        buildCarDetailSearchPath(car, {
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

  return (
    <CarBookingCardFields
      key={resetKey}
      car={car}
      query={query}
      initialFromDate={initialFromDate}
      initialToDate={initialToDate}
      initialPickupTime={query.search.pickupTime ?? undefined}
      initialFlightNumber={query.search.flightNumber ?? ""}
      airportPickup={airportPickup}
    />
  );
}
