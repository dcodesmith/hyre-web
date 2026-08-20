import { Tag } from "lucide-react";
import { useId, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

import type { PublicCarDetail } from "~/api/cars/schema";
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
}

function CarBookingCardFields({
  car,
  query,
  initialFromDate,
  initialToDate,
  initialPickupTime,
  initialFlightNumber,
}: CarBookingCardFieldsProps) {
  const navigate = useNavigate();
  const pickupTimeId = useId();
  const flightNumberId = useId();
  const [fromDate, setFromDate] = useState(initialFromDate);
  const [toDate, setToDate] = useState(initialToDate);
  const [pickupTime, setPickupTime] = useState(initialPickupTime);
  const [flightNumber, setFlightNumber] = useState(initialFlightNumber);
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
  }): CarDetailUrlQuery => ({
    ...query,
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
    commitBookingFields({
      from: date ? formatZonedDate(date) : null,
      to: nextTo ? formatZonedDate(nextTo) : null,
      pickupTime: bookingType === NIGHT_BOOKING_TYPE ? "11 PM" : (nextPickup ?? null),
    });
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

  return (
    <Card className="gap-0 rounded py-0 shadow-xl ring-0 inset-shadow-sm transform-gpu">
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
        <div className="space-y-1">
          <Label className="font-semibold">Booking Type</Label>
          <BookingTypeTabs
            value={bookingType}
            onValueChange={handleBookingTypeChange}
            variant="modal"
          />
        </div>

        <div className="space-y-1">
          <Label className="font-semibold">
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
          <div className="space-y-1">
            <Label htmlFor={flightNumberId} className="font-semibold">
              Flight Number
            </Label>
            <input
              id={flightNumberId}
              type="text"
              value={flightNumber}
              onChange={(event) => setFlightNumber(event.target.value)}
              onBlur={(event) => {
                const value = event.target.value;
                setFlightNumber(value);
                commitBookingFields({ flightNumber: value || null });
              }}
              placeholder="e.g. BA123…"
              autoComplete="off"
              spellCheck={false}
              className="flex h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
        ) : null}

        {hasCompleteDates && !isAirportPickup && bookingType !== NIGHT_BOOKING_TYPE ? (
          <div className="space-y-1">
            <Label htmlFor={pickupTimeId} className="font-semibold">
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
  const query = parseCarDetailUrl(searchParams);
  const initialFromDate = query.search.from ? parseZonedCalendarDate(query.search.from) : undefined;
  const initialToDate = query.search.to
    ? parseZonedCalendarDate(query.search.to)
    : nextToDateOnFromChange(query.bookingType, initialFromDate, undefined);
  const resetKey = [
    query.bookingType,
    query.search.from,
    query.search.to,
    query.search.pickupTime,
    query.search.flightNumber,
  ].join("|");

  return (
    <CarBookingCardFields
      key={resetKey}
      car={car}
      query={query}
      initialFromDate={initialFromDate}
      initialToDate={initialToDate}
      initialPickupTime={query.search.pickupTime ?? undefined}
      initialFlightNumber={query.search.flightNumber ?? ""}
    />
  );
}
