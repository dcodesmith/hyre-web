import { useState } from "react";
import { Form, useLocation, useNavigate, useSearchParams } from "react-router";

import { isCompleteFlightNumber } from "~/booking/airport-pickup";
import { BookingTypeTabs } from "~/booking/booking-type-tabs";
import { isValidToDateSelection, nextToDateOnFromChange } from "~/booking/dates";
import { nextPickupTimeOnFromChange } from "~/booking/pickup";
import {
  AIRPORT_PICKUP_BOOKING_TYPE,
  type BookingType,
  DAY_BOOKING_TYPE,
  NIGHT_BOOKING_TYPE,
} from "~/booking/types";
import { useAirportPickup } from "~/hooks/use-airport-pickup";
import { cn } from "~/lib/utils";
import {
  AirportSearchFields,
  SearchButton,
  StandardSearchFields,
} from "~/search/search-form-controls";
import {
  buildBookingTypeSearchPath,
  parseSearchUrl,
  SEARCH_FILTER_PARAM_KEYS,
} from "~/search/search-url";
import { formatZonedDate, parseZonedCalendarDate } from "~/time/timezone";

interface SearchFormProps {
  readonly isCompact?: boolean;
  readonly context?: "hero" | "modal";
  readonly preserveFilterParams?: boolean;
  readonly onSearchComplete?: () => void;
}

interface SearchFormFieldsProps extends SearchFormProps {
  readonly initialBookingType: BookingType;
  readonly initialFromDate: Date | undefined;
  readonly initialToDate: Date | undefined;
  readonly initialPickupTime: string | undefined;
  readonly initialFlightNumber: string;
}

type SearchFormState = {
  readonly bookingType: BookingType;
  readonly fromDate: Date | undefined;
  readonly toDate: Date | undefined;
  readonly pickupTime: string | undefined;
  readonly flightNumber: string;
};

function SearchFormFields({
  isCompact = false,
  context = "hero",
  preserveFilterParams = false,
  onSearchComplete,
  initialBookingType,
  initialFromDate,
  initialToDate,
  initialPickupTime,
  initialFlightNumber,
}: SearchFormFieldsProps) {
  const [searchParams] = useSearchParams();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [state, setState] = useState<SearchFormState>(() => ({
    bookingType: initialBookingType,
    fromDate: initialFromDate,
    toDate: initialToDate,
    pickupTime: initialPickupTime,
    flightNumber: initialFlightNumber,
  }));
  const [fallbackDate] = useState(() => new Date());
  const airportPickup = useAirportPickup();
  const { bookingType, flightNumber, fromDate, pickupTime, toDate } = state;
  const isAirportPickup = bookingType === AIRPORT_PICKUP_BOOKING_TYPE;
  const isNight = bookingType === NIGHT_BOOKING_TYPE;

  const lookupFlight = (value: string, date: Date | undefined) => {
    if (date && isCompleteFlightNumber(value)) {
      airportPickup.searchFlight(value, formatZonedDate(date));
      return;
    }

    airportPickup.resetFlight();
  };

  const handleBookingTypeChange = (nextBookingType: BookingType) => {
    setState({
      bookingType: nextBookingType,
      fromDate: undefined,
      toDate: undefined,
      pickupTime: undefined,
      flightNumber: "",
    });
    airportPickup.resetFlight();

    if (pathname === "/search") {
      navigate(buildBookingTypeSearchPath(nextBookingType, searchParams), {
        replace: true,
        preventScrollReset: true,
      });
    }
  };

  const handleFromDateChange = (date: Date | undefined) => {
    setState((current) => ({
      ...current,
      fromDate: date,
      toDate: nextToDateOnFromChange(current.bookingType, date, current.toDate),
      pickupTime: nextPickupTimeOnFromChange({
        bookingType: current.bookingType,
        fromDate: date,
        currentPickupTime: current.pickupTime,
        fallbackDate,
      }),
    }));
    lookupFlight(flightNumber, date);
  };

  const handleFlightNumberChange = (value: string) => {
    setState((current) => ({ ...current, flightNumber: value }));
    airportPickup.resetFlight();
  };

  const handleFlightNumberBlur = (value: string) => {
    setState((current) => ({ ...current, flightNumber: value }));
    lookupFlight(value, fromDate);
  };

  const handleToDateChange = (date: Date | undefined) => {
    if (!isValidToDateSelection(bookingType, fromDate, date)) {
      return;
    }

    setState((current) => ({ ...current, toDate: date }));
  };

  return (
    <Form method="get" action="/search" className="w-full text-left" onSubmit={onSearchComplete}>
      <input type="hidden" name="bookingType" value={bookingType} />
      {fromDate ? <input type="hidden" name="from" value={formatZonedDate(fromDate)} /> : null}
      {toDate ? <input type="hidden" name="to" value={formatZonedDate(toDate)} /> : null}
      {isAirportPickup ? <input type="hidden" name="flightNumber" value={flightNumber} /> : null}
      {isNight ? <input type="hidden" name="pickupTime" value="11 PM" /> : null}
      {preserveFilterParams
        ? ["q", "color", "model", ...SEARCH_FILTER_PARAM_KEYS].map((key) => {
            const value = searchParams.get(key);

            return value ? <input key={key} type="hidden" name={key} value={value} /> : null;
          })
        : null}

      {isCompact ? null : (
        <div className="mb-4 max-h-24 overflow-hidden opacity-100 transition-[max-height,opacity] duration-300 motion-reduce:transition-none">
          <BookingTypeTabs
            value={bookingType}
            onValueChange={handleBookingTypeChange}
            variant={context}
          />
        </div>
      )}

      <div className="w-full">
        <div
          className={cn(
            "border border-gray-200 bg-white transition-shadow duration-300 motion-reduce:transition-none",
            isCompact
              ? "rounded-full shadow-md hover:shadow-lg"
              : "rounded-3xl shadow-2xl hover:shadow-xl md:rounded-full",
          )}
        >
          <div
            className={cn(
              "flex items-stretch",
              isCompact ? "flex-row divide-x divide-gray-300" : "flex-col md:flex-row",
            )}
          >
            {isCompact ? (
              <div className="flex flex-none items-center py-2 pr-3 pl-4">
                <BookingTypeTabs
                  value={bookingType}
                  onValueChange={handleBookingTypeChange}
                  variant="compact"
                />
              </div>
            ) : null}

            {isAirportPickup ? (
              <AirportSearchFields
                isCompact={isCompact}
                fromDate={fromDate}
                flightNumber={flightNumber}
                fallbackDate={fallbackDate}
                validatedFlight={airportPickup.flight}
                flightError={airportPickup.flightError}
                onFromDateChange={handleFromDateChange}
                onFlightNumberChange={handleFlightNumberChange}
                onFlightNumberBlur={handleFlightNumberBlur}
              />
            ) : (
              <StandardSearchFields
                isCompact={isCompact}
                bookingType={bookingType}
                fromDate={fromDate}
                toDate={toDate}
                pickupTime={pickupTime}
                fallbackDate={fallbackDate}
                onFromDateChange={handleFromDateChange}
                onToDateChange={handleToDateChange}
                onPickupTimeChange={(value) =>
                  setState((current) => ({ ...current, pickupTime: value }))
                }
              />
            )}
            <div
              className={cn(
                "flex items-center justify-center self-stretch",
                isCompact ? "" : "border-t md:border-t-0 md:border-l md:border-gray-200",
              )}
            >
              <SearchButton isCompact={isCompact} />
            </div>
          </div>
        </div>
      </div>
    </Form>
  );
}

export function SearchForm({
  isCompact = false,
  context = "hero",
  preserveFilterParams = false,
  onSearchComplete,
}: SearchFormProps) {
  const [searchParams] = useSearchParams();
  const query = parseSearchUrl(searchParams);
  const initialBookingType = query.bookingType ?? DAY_BOOKING_TYPE;
  const resetKey = [
    initialBookingType,
    query.from,
    query.to,
    query.pickupTime,
    query.flightNumber,
  ].join("|");

  return (
    <SearchFormFields
      key={resetKey}
      isCompact={isCompact}
      context={context}
      preserveFilterParams={preserveFilterParams}
      onSearchComplete={onSearchComplete}
      initialBookingType={initialBookingType}
      initialFromDate={query.from ? parseZonedCalendarDate(query.from) : undefined}
      initialToDate={query.to ? parseZonedCalendarDate(query.to) : undefined}
      initialPickupTime={query.pickupTime ?? undefined}
      initialFlightNumber={query.flightNumber ?? ""}
    />
  );
}
