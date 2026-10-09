import { cn } from "cn";
import { Loader2, Search } from "lucide-react";
import { useNavigation } from "react-router";
import type { SearchFlight } from "~/api/flights/schema";
import { BookingTypeInput } from "~/booking/booking-type-input";
import { AIRPORT_PICKUP_BOOKING_TYPE, type BookingType } from "~/booking/types";
import { Button } from "~/components/ui/button";
import { SearchDateRangePicker, SearchSingleDatePicker } from "~/search/search-date-picker";

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
  readonly onRangeChange: (from: Date | undefined, to: Date | undefined) => void;
  readonly onPickupTimeChange: (value: string) => void;
}

export function SearchButton({ isCompact }: { readonly isCompact: boolean }) {
  const navigation = useNavigation();
  const isSearching = navigation.state !== "idle" && navigation.location?.pathname === "/search";
  const searchButtonText = isSearching ? "Searching…" : "Search";

  return (
    <Button
      type="submit"
      aria-label={isSearching ? "Searching" : "Search for vehicles"}
      disabled={isSearching}
      className={cn(
        "gap-2 rounded-md px-4 text-sm leading-5 font-medium shadow-[0_1px_1px_rgba(0,0,0,0.05)]",
        isCompact ? "h-12 w-[119px] shrink-0" : "h-13 w-full",
      )}
    >
      {isSearching ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <Search className="size-4" aria-hidden="true" />
      )}
      <span>{searchButtonText}</span>
    </Button>
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
  return (
    <div
      className={cn(
        isCompact
          ? "contents"
          : "flex h-[130px] w-full flex-col gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3",
      )}
    >
      <div className={cn(isCompact && "h-full w-[113px] shrink-0")}>
        <SearchSingleDatePicker
          bookingType={AIRPORT_PICKUP_BOOKING_TYPE}
          date={fromDate}
          onDateChange={onFromDateChange}
          compact={isCompact}
        />
      </div>
      <div
        className={cn(
          isCompact ? "h-full w-px shrink-0 bg-gray-300" : "h-0 border-t border-gray-200",
        )}
      />
      <div className={cn(isCompact && "h-full w-[122px] shrink-0")}>
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
          presentation={isCompact ? "compact" : "card"}
        />
      </div>
    </div>
  );
}

export function StandardSearchFields({
  isCompact,
  bookingType,
  fromDate,
  toDate,
  pickupTime,
  fallbackDate,
  onRangeChange,
  onPickupTimeChange,
}: StandardSearchFieldsProps) {
  return (
    <div
      key={bookingType}
      className={cn(
        isCompact
          ? "contents"
          : "flex h-[130px] w-full flex-col gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3",
      )}
    >
      <div className={cn(isCompact && "h-full w-[113px] shrink-0")}>
        <SearchDateRangePicker
          bookingType={bookingType}
          fromDate={fromDate}
          toDate={toDate}
          onRangeChange={onRangeChange}
          compact={isCompact}
        />
      </div>
      <div
        className={cn(
          isCompact ? "h-full w-px shrink-0 bg-gray-300" : "h-0 border-t border-gray-200",
        )}
      />
      <div className={cn(isCompact && "h-full w-[122px] shrink-0")}>
        <BookingTypeInput
          bookingType={bookingType}
          pickupTime={pickupTime}
          flightNumber=""
          fromDate={fromDate}
          fallbackDate={fallbackDate}
          onPickupTimeChange={onPickupTimeChange}
          presentation={isCompact ? "compact" : "card"}
        />
      </div>
    </div>
  );
}
