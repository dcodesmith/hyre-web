import { Loader2, Search } from "lucide-react";
import { useNavigation } from "react-router";

import type { SearchFlight } from "~/api/flights/schema";
import { BookingTypeInput } from "~/booking/booking-type-input";
import { getToDateMinDate } from "~/booking/dates";
import { SingleDatePicker } from "~/booking/single-date-picker";
import { AIRPORT_PICKUP_BOOKING_TYPE, type BookingType } from "~/booking/types";
import { cn } from "~/lib/utils";

interface AirportSearchFieldsProps {
  readonly isCompact: boolean;
  readonly fromDate: Date | undefined;
  readonly flightNumber: string;
  readonly fallbackDate: Date;
  readonly validatedFlight: SearchFlight | null;
  readonly flightError: string | null;
  readonly onFromDateChange: (date: Date | undefined) => void;
  readonly onFlightNumberChange: (value: string) => void;
  readonly onFlightNumberBlur: (value: string) => void;
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

export function SearchButton({ isCompact }: { readonly isCompact: boolean }) {
  const navigation = useNavigation();
  const isSearching = navigation.state !== "idle" && navigation.location?.pathname === "/search";
  const searchButtonText = isSearching ? "Searching…" : "Search";

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
          "inline-flex cursor-pointer items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground transition-colors duration-300 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 motion-reduce:transition-none",
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

export function AirportSearchFields({
  isCompact,
  fromDate,
  flightNumber,
  fallbackDate,
  validatedFlight,
  flightError,
  onFromDateChange,
  onFlightNumberChange,
  onFlightNumberBlur,
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
            validatedFlight={validatedFlight}
            flightError={flightError}
            onFlightNumberChange={onFlightNumberChange}
            onFlightNumberBlur={onFlightNumberBlur}
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
          validatedFlight={validatedFlight}
          flightError={flightError}
          onFlightNumberChange={onFlightNumberChange}
          onFlightNumberBlur={onFlightNumberBlur}
        />
      </div>
    </>
  );
}

export function StandardSearchFields({
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
