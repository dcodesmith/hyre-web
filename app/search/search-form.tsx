import { Loader2, Search } from "lucide-react";
import { useState } from "react";
import { Form, useNavigation, useSearchParams } from "react-router";

import { BookingTypeInput } from "~/booking/booking-type-input";
import { BookingTypeTabs } from "~/booking/booking-type-tabs";
import { getToDateMinDate, isValidToDateSelection, nextToDateOnFromChange } from "~/booking/dates";
import { nextPickupTimeOnFromChange } from "~/booking/pickup";
import { SingleDatePicker } from "~/booking/single-date-picker";
import {
  AIRPORT_PICKUP_BOOKING_TYPE,
  type BookingType,
  DAY_BOOKING_TYPE,
  NIGHT_BOOKING_TYPE,
} from "~/booking/types";
import { cn } from "~/lib/utils";
import { parseSearchUrl, SEARCH_FILTER_PARAM_KEYS } from "~/search/search-url";
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

interface AirportSearchFieldsProps {
  readonly isCompact: boolean;
  readonly fromDate: Date | undefined;
  readonly flightNumber: string;
  readonly fallbackDate: Date;
  readonly onFromDateChange: (date: Date | undefined) => void;
  readonly onFlightNumberChange: (value: string) => void;
}

interface StandardSearchFieldsProps {
  readonly isCompact: boolean;
  readonly bookingType: BookingType;
  readonly fromDate: Date | undefined;
  readonly toDate: Date | undefined;
  readonly pickupTime: string | undefined;
  readonly fallbackDate: Date;
  readonly onFromDateChange: (date: Date | undefined) => void;
  readonly onToDateChange: (date: Date | undefined) => void;
  readonly onPickupTimeChange: (value: string) => void;
}

function SearchButton({ isCompact }: { readonly isCompact: boolean }) {
  const navigation = useNavigation();
  const isSearching = navigation.state !== "idle" && navigation.location?.pathname === "/search";
  const searchButtonText = isSearching ? "Searching..." : "Search";

  return (
    <div
      className={cn(
        "flex items-center justify-center",
        isCompact ? "flex-none px-2 py-2" : "min-h-15 w-full px-4 py-3 sm:px-3 md:w-auto md:py-2",
      )}
    >
      <button
        type="submit"
        aria-label={isSearching ? "Searching" : "Search for vehicles"}
        disabled={isSearching}
        className={cn(
          "inline-flex cursor-pointer items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground transition-all duration-300 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50",
          isCompact
            ? "size-9 p-0"
            : "h-12 w-full gap-2 px-6 py-2 text-sm md:w-auto md:px-8 md:text-base",
        )}
      >
        {isSearching ? (
          <Loader2
            className={cn("animate-spin", isCompact ? "size-4" : "size-5")}
            aria-hidden="true"
          />
        ) : (
          <Search
            className={cn(isCompact ? "size-4" : "mr-2 size-5 shrink-0")}
            aria-hidden="true"
          />
        )}
        {isCompact ? null : <span className="md:hidden">{searchButtonText}</span>}
      </button>
    </div>
  );
}

function AirportSearchFields({
  isCompact,
  fromDate,
  flightNumber,
  fallbackDate,
  onFromDateChange,
  onFlightNumberChange,
}: AirportSearchFieldsProps) {
  if (isCompact) {
    return (
      <div className="flex flex-1 items-stretch divide-x divide-gray-300">
        <div className="flex flex-1 items-center py-2 pr-3 pl-4">
          <SingleDatePicker
            className="w-full"
            bookingType={AIRPORT_PICKUP_BOOKING_TYPE}
            date={fromDate}
            onDateChange={onFromDateChange}
            isCompact
            label="Date"
          />
        </div>
        <div className="flex flex-1 items-center px-3 py-2">
          <BookingTypeInput
            bookingType={AIRPORT_PICKUP_BOOKING_TYPE}
            pickupTime={undefined}
            flightNumber={flightNumber}
            fromDate={fromDate}
            fallbackDate={fallbackDate}
            onFlightNumberChange={onFlightNumberChange}
            isCompact
          />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex min-h-15 flex-1 items-center px-4 py-3 sm:px-6">
        <SingleDatePicker
          className="w-full"
          bookingType={AIRPORT_PICKUP_BOOKING_TYPE}
          date={fromDate}
          onDateChange={onFromDateChange}
          label="Date"
        />
      </div>
      <div className="flex min-h-15 flex-1 items-center border-t px-4 py-3 sm:px-6 md:border-t-0 md:border-l md:border-gray-200">
        <BookingTypeInput
          bookingType={AIRPORT_PICKUP_BOOKING_TYPE}
          pickupTime={undefined}
          flightNumber={flightNumber}
          fromDate={fromDate}
          fallbackDate={fallbackDate}
          onFlightNumberChange={onFlightNumberChange}
        />
      </div>
    </>
  );
}

function StandardSearchFields({
  isCompact,
  bookingType,
  fromDate,
  toDate,
  pickupTime,
  fallbackDate,
  onFromDateChange,
  onToDateChange,
  onPickupTimeChange,
}: StandardSearchFieldsProps) {
  if (isCompact) {
    return (
      <div className="flex flex-1 items-stretch divide-x divide-gray-300">
        <div className="flex flex-1 items-center py-2 pr-3 pl-4">
          <SingleDatePicker
            className="w-full"
            bookingType={bookingType}
            date={fromDate}
            onDateChange={onFromDateChange}
            isCompact
            label="From"
          />
        </div>
        <div className="flex flex-1 items-center px-3 py-2">
          <SingleDatePicker
            className="w-full"
            bookingType={bookingType}
            date={toDate}
            onDateChange={onToDateChange}
            isCompact
            label="To"
            minDate={getToDateMinDate(bookingType, fromDate)}
            disabled={!fromDate}
          />
        </div>
        <div className="flex flex-1 items-center px-3 py-2">
          <BookingTypeInput
            bookingType={bookingType}
            pickupTime={pickupTime}
            flightNumber=""
            fromDate={fromDate}
            fallbackDate={fallbackDate}
            onPickupTimeChange={onPickupTimeChange}
            isCompact
          />
        </div>
      </div>
    );
  }

  return (
    <div key={bookingType} className="grid min-h-15 w-full flex-1 grid-cols-2 md:grid-cols-3">
      <div className="flex min-w-0 items-center border-r border-gray-200 px-4 py-3 sm:px-6">
        <SingleDatePicker
          className="w-full"
          bookingType={bookingType}
          date={fromDate}
          onDateChange={onFromDateChange}
          label="From"
        />
      </div>
      <div className="flex min-w-0 items-center px-4 py-3 sm:px-6">
        <SingleDatePicker
          className="w-full"
          bookingType={bookingType}
          date={toDate}
          onDateChange={onToDateChange}
          label="To"
          minDate={getToDateMinDate(bookingType, fromDate)}
          disabled={!fromDate}
        />
      </div>
      <div className="col-span-2 flex min-h-15 min-w-0 items-center border-t border-gray-200 px-4 py-3 sm:px-6 md:col-span-1 md:border-t-0 md:border-l">
        <BookingTypeInput
          bookingType={bookingType}
          pickupTime={pickupTime}
          flightNumber=""
          fromDate={fromDate}
          fallbackDate={fallbackDate}
          onPickupTimeChange={onPickupTimeChange}
        />
      </div>
    </div>
  );
}

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
  const [bookingType, setBookingType] = useState<BookingType>(initialBookingType);
  const [fromDate, setFromDate] = useState<Date | undefined>(initialFromDate);
  const [toDate, setToDate] = useState<Date | undefined>(initialToDate);
  const [pickupTime, setPickupTime] = useState<string | undefined>(initialPickupTime);
  const [flightNumber, setFlightNumber] = useState(initialFlightNumber);
  const [fallbackDate] = useState(() => new Date());
  const isAirportPickup = bookingType === AIRPORT_PICKUP_BOOKING_TYPE;
  const isNight = bookingType === NIGHT_BOOKING_TYPE;

  const handleBookingTypeChange = (nextBookingType: BookingType) => {
    setBookingType(nextBookingType);
    setFromDate(undefined);
    setToDate(undefined);
    setPickupTime(undefined);
    setFlightNumber("");
  };

  const handleFromDateChange = (date: Date | undefined) => {
    setFromDate(date);
    setToDate(nextToDateOnFromChange(bookingType, date, toDate));
    setPickupTime(
      nextPickupTimeOnFromChange({
        bookingType,
        fromDate: date,
        currentPickupTime: pickupTime,
        fallbackDate,
      }),
    );
  };

  const handleToDateChange = (date: Date | undefined) => {
    if (!isValidToDateSelection(bookingType, fromDate, date)) {
      return;
    }

    setToDate(date);
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
        <div className="mb-4 max-h-24 overflow-hidden opacity-100 transition-all duration-300">
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
            "border border-gray-200 bg-white transition-all duration-300",
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
                onFromDateChange={handleFromDateChange}
                onFlightNumberChange={setFlightNumber}
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
                onPickupTimeChange={setPickupTime}
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
