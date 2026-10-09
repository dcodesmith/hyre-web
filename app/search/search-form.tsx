import { cn } from "cn";
import { useState } from "react";
import { Form, useLocation, useNavigate, useSearchParams } from "react-router";
import { isCompleteFlightNumber } from "~/booking/airport-pickup";
import { nextToDateOnFromChange } from "~/booking/dates";
import { nextPickupTimeOnFromChange } from "~/booking/pickup";
import {
  AIRPORT_PICKUP_BOOKING_TYPE,
  type BookingType,
  DAY_BOOKING_TYPE,
  NIGHT_BOOKING_TYPE,
} from "~/booking/types";
import { useAirportPickup } from "~/hooks/use-airport-pickup";
import { SearchBookingTypeSelect, SearchBookingTypeTabs } from "~/search/search-booking-type-tabs";
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

  const handleRangeChange = (from: Date | undefined, to: Date | undefined) => {
    setState((current) => ({
      ...current,
      fromDate: from,
      toDate: to,
      pickupTime: nextPickupTimeOnFromChange({
        bookingType: current.bookingType,
        fromDate: from,
        currentPickupTime: current.pickupTime,
        fallbackDate,
      }),
    }));
  };

  return (
    <Form
      method="get"
      action="/search"
      className="font-search w-full text-left"
      onSubmit={onSearchComplete}
    >
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

      <div
        className={cn(
          isCompact
            ? "mx-auto h-17.5 w-full max-w-161 rounded-lg border border-gray-300 bg-white px-4 py-2"
            : "flex h-[326px] w-full flex-col items-center gap-6 rounded-lg bg-gray-50 px-4 py-6 ring-1 ring-inset ring-gray-200 md:h-[330px]",
        )}
      >
        {isCompact ? (
          <div className="flex h-full w-full items-center gap-4">
            <SearchBookingTypeSelect value={bookingType} onValueChange={handleBookingTypeChange} />
            <div className="h-full w-px shrink-0 bg-gray-300" />
            {isAirportPickup ? (
              <AirportSearchFields
                isCompact
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
                isCompact
                bookingType={bookingType}
                fromDate={fromDate}
                toDate={toDate}
                pickupTime={pickupTime}
                fallbackDate={fallbackDate}
                onRangeChange={handleRangeChange}
                onPickupTimeChange={(value) =>
                  setState((current) => ({ ...current, pickupTime: value }))
                }
              />
            )}
            <SearchButton isCompact />
          </div>
        ) : (
          <>
            <SearchBookingTypeTabs value={bookingType} onValueChange={handleBookingTypeChange} />
            {isAirportPickup ? (
              <AirportSearchFields
                isCompact={false}
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
                isCompact={false}
                bookingType={bookingType}
                fromDate={fromDate}
                toDate={toDate}
                pickupTime={pickupTime}
                fallbackDate={fallbackDate}
                onRangeChange={handleRangeChange}
                onPickupTimeChange={(value) =>
                  setState((current) => ({ ...current, pickupTime: value }))
                }
              />
            )}
            <SearchButton isCompact={false} />
          </>
        )}
      </div>
    </Form>
  );
}

export function SearchForm({
  isCompact = false,
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
