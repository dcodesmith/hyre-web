import { useNavigation, useSearchParams } from "@remix-run/react";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { DateRange } from "react-day-picker";
import { DateRangePicker } from "./booking/DateRangePicker";

import type { ValidatedFlight } from "~/services/flight-validation.server";
import { AutocompleteFlight } from "./AutocompleteFlight";
import { BookingTimeSelect } from "./booking/BookingTimeSelect";
import {
  AIRPORT_PICKUP_BOOKING_TYPE,
  BOOKING_TYPE_OPTIONS,
  BOOKING_TYPE_OPTIONS_MAP,
  BookingType,
  DAY_BOOKING_TYPE,
  FULL_DAY_BOOKING_TYPE,
  NIGHT_BOOKING_TYPE,
  TAB_VALUE_TO_BOOKING_TYPE,
} from "./bookingTypes";
import { Button } from "./ui/button";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";
import { formatInTimeZone } from "date-fns-tz";
import { LAGOS_TIMEZONE } from "~/utils/timezone";

type FlightValidationNoticeProps = {
  readonly validatedFlight: ValidatedFlight | null;
  readonly message: string | null;
  readonly isWarning?: boolean;
};

function FlightValidationNotice({
  validatedFlight,
  message,
  isWarning = false,
}: FlightValidationNoticeProps) {
  // Show validated flight info with optional warning
  if (validatedFlight) {
    return (
      <div className="w-74 flex flex-col gap-2 text-xs">
        {/* Flight info */}
        <div className="flex items-center justify-center text-gray-600 min-h-10">
          <div className="flex items-center text-center gap-2 flex-col">
            <span className="text-green-700">
              {validatedFlight.originIATA || validatedFlight.origin} →{" "}
              {validatedFlight.destinationIATA || validatedFlight.destination} ( Arrives at{" "}
              {new Date(
                validatedFlight.actualArrival ||
                  validatedFlight.estimatedArrival ||
                  validatedFlight.scheduledArrival,
              ).toLocaleTimeString("en-US", {
                timeZone: "Africa/Lagos",
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })}{" "}
              local time )
            </span>
            {message && isWarning && <p>{message}</p>}
          </div>

          {validatedFlight.delay && validatedFlight.delay > 0 && (
            <p className="text-xs text-orange-600 mt-1">
              Delayed by {validatedFlight.delay} minutes
            </p>
          )}
        </div>
      </div>
    );
  }

  // Show informational or error message (flight not found, doesn't fly to Lagos, etc.)
  if (message) {
    return (
      <div className="w-74 flex items-center justify-center text-xs text-gray-600 h-10">
        <p className="text-xs text-gray-700">{message}</p>
      </div>
    );
  }

  return null;
}

export function BookingSearch() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigation = useNavigation();
  const [isSearchClicked, setIsSearchClicked] = useState(false);
  const [validatedFlight, setValidatedFlight] = useState<ValidatedFlight | null>(null);
  const [flightValidationError, setFlightValidationError] = useState<string | null>(null);
  const [isValidationWarning, setIsValidationWarning] = useState(false);

  // Check if page is loading/searching - only show loading if user clicked Search button
  const isSearching = navigation.state === "loading" && isSearchClicked;

  // Reset search clicked state when navigation completes
  useEffect(() => {
    if (navigation.state === "idle") {
      setIsSearchClicked(false);
    }
  }, [navigation.state]);

  // Helper to validate booking type
  const isValidBookingType = useCallback(
    (value: string | null): value is BookingType =>
      !!value && (BOOKING_TYPE_OPTIONS as readonly string[]).includes(value),
    [],
  );

  // Get initial values from URL params
  const urlBookingTypeParam = searchParams.get("bookingType");
  const initialBookingType: BookingType = isValidBookingType(urlBookingTypeParam)
    ? urlBookingTypeParam
    : DAY_BOOKING_TYPE;
  const initialFrom = searchParams.get("from");
  const initialTo = searchParams.get("to");
  const initialPickupTime = searchParams.get("pickupTime") || undefined;
  const initialFlightNumber = searchParams.get("flightNumber") || undefined;

  // Use local state for form inputs (only sync to URL on Search button click or booking type change)
  const [bookingType, setBookingType] = useState<BookingType>(initialBookingType);
  const [dateRange, setDateRange] = useState<DateRange>({
    from: initialFrom ? new Date(`${initialFrom}T00:00:00Z`) : undefined,
    to: initialTo ? new Date(`${initialTo}T00:00:00Z`) : undefined,
  });
  const [pickupTime, setPickupTime] = useState<string | undefined>(initialPickupTime);
  const [flightNumber, setFlightNumber] = useState<string | undefined>(initialFlightNumber);

  // Sync state when URL changes (e.g., navigating back from car details page)
  useEffect(() => {
    const urlBookingType = searchParams.get("bookingType");
    const urlFrom = searchParams.get("from");
    const urlTo = searchParams.get("to");
    const urlPickupTime = searchParams.get("pickupTime");
    const urlFlightNumber = searchParams.get("flightNumber");

    if (urlBookingType && isValidBookingType(urlBookingType)) {
      setBookingType(urlBookingType);
    }

    setDateRange({
      from: urlFrom ? new Date(`${urlFrom}T00:00:00Z`) : undefined,
      to: urlTo ? new Date(`${urlTo}T00:00:00Z`) : undefined,
    });

    setPickupTime(urlPickupTime || undefined);
    setFlightNumber(urlFlightNumber || undefined);
  }, [searchParams, isValidBookingType]);

  const handleBookingTypeChange = useCallback(
    (tabValue: string) => {
      const newBookingType = TAB_VALUE_TO_BOOKING_TYPE[tabValue];
      if (newBookingType) {
        setBookingType(newBookingType);
        // Reset dates, pickup time, and flight number when booking type changes
        setDateRange({ from: undefined, to: undefined });
        setPickupTime(undefined);
        setFlightNumber(undefined);
        setValidatedFlight(null);
        setFlightValidationError(null);
        setIsValidationWarning(false);

        // Update URL immediately for booking type only
        const newSearchParams = new URLSearchParams();
        newSearchParams.set("bookingType", newBookingType);
        setSearchParams(newSearchParams, { replace: true, preventScrollReset: true });
      }
    },
    [setSearchParams],
  );

  const handlePickupTimeChange = useCallback((value: string) => {
    // Update local state only, don't update URL yet
    setPickupTime(value);
  }, []);

  const handleFlightNumberChange = useCallback((value: string) => {
    // Update local state only, don't update URL yet
    setFlightNumber(value);
    // Clear validation when user manually types (not when autocomplete selects)
    setValidatedFlight(null);
    setFlightValidationError(null);
    setIsValidationWarning(false);
  }, []);

  const handleFlightNumberSelect = useCallback((value: string) => {
    // Update local state when autocomplete selection is made
    // Don't clear validation state - the validation callback will set it
    setFlightNumber(value);
  }, []);

  const handleDateRangeChange = useCallback((newDateRange: DateRange) => {
    // Update local state only, don't update URL yet
    setDateRange(newDateRange);
    setValidatedFlight(null);
    setFlightValidationError(null);
    setIsValidationWarning(false);
  }, []);

  const handleSearch = useCallback(() => {
    // Set flag to show loading indicator
    setIsSearchClicked(true);

    const newSearchParams = new URLSearchParams();

    newSearchParams.set("bookingType", bookingType);

    if (dateRange.from) {
      newSearchParams.set("from", format(dateRange.from, "yyyy-MM-dd"));
    }
    if (dateRange.to) {
      newSearchParams.set("to", format(dateRange.to, "yyyy-MM-dd"));
    }
    // Always send pickupTime - use "11 PM" for NIGHT bookings (fixed start time)
    // Send flightNumber for airport pickup instead of pickupTime
    if (bookingType === AIRPORT_PICKUP_BOOKING_TYPE) {
      if (flightNumber) {
        newSearchParams.set("flightNumber", flightNumber);
      }
    } else {
      const effectivePickupTime = bookingType === NIGHT_BOOKING_TYPE ? "11 PM" : pickupTime;
      if (effectivePickupTime) {
        newSearchParams.set("pickupTime", effectivePickupTime);
      }
    }

    setSearchParams(newSearchParams, { replace: true, preventScrollReset: true });
  }, [bookingType, dateRange, pickupTime, flightNumber, setSearchParams]);

  const renderBookingTypeInput = () => {
    if (bookingType === NIGHT_BOOKING_TYPE) {
      return (
        <p className="text-xs text-gray-600 h-10 items-center flex">
          Night bookings start at 11pm and end at 5am.
        </p>
      );
    }

    if (bookingType === AIRPORT_PICKUP_BOOKING_TYPE) {
      return (
        <div className="w-full space-y-2">
          <AutocompleteFlight
            id="flightNumber"
            onSelect={handleFlightNumberSelect}
            inputProps={{
              value: flightNumber || "",
              onChange: (e) => handleFlightNumberChange(e.target.value),
            }}
            initialValue={flightNumber}
            className="w-full placeholder-black"
            nigeriaOnly={true}
            pickupDate={
              dateRange.from
                ? formatInTimeZone(dateRange.from, LAGOS_TIMEZONE, "yyyy-MM-dd")
                : undefined
            }
            showValidation={false}
            onFlightValidated={(flight) => {
              setValidatedFlight(flight);
              setFlightValidationError(null);
              setIsValidationWarning(false);
            }}
            onValidationError={(message, isWarning = false) => {
              setFlightValidationError(message);
              setIsValidationWarning(isWarning);
            }}
          />

          {(validatedFlight || flightValidationError) && (
            <FlightValidationNotice
              validatedFlight={validatedFlight}
              message={flightValidationError}
              isWarning={isValidationWarning}
            />
          )}
        </div>
      );
    }

    return (
      <BookingTimeSelect
        key={bookingType}
        date={dateRange.from ?? new Date()}
        bookingType={bookingType}
        defaultValue={pickupTime}
        onValueChange={handlePickupTimeChange}
      />
    );
  };

  return (
    <div className="w-74 md:w-full flex flex-col items-center justify-center gap-2 mt-4 mb-2">
      <Tabs
        className="w-74 md:w-full"
        value={BOOKING_TYPE_OPTIONS_MAP[bookingType].value}
        onValueChange={handleBookingTypeChange}
      >
        <TabsList className="p-2 gap-2 tabs-list-slider w-74 md:w-full h-auto before:w-[calc((100%-0.5rem)/4)]">
          {BOOKING_TYPE_OPTIONS.map((type) => {
            const option = BOOKING_TYPE_OPTIONS_MAP[type];
            return (
              <TabsTrigger
                key={option.value}
                className="flex flex-col items-center justify-center min-w-0 data-[state=active]:shadow-none tabs-trigger-slider data-[state=active]:bg-transparent"
                value={option.value}
              >
                <span className="text-sm font-semibold text-center">{option.label}</span>
                <span className="text-xs text-gray-600 text-center">{option.duration}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      <DateRangePicker
        className="w-74 md:w-full"
        date={dateRange}
        onDateChange={handleDateRangeChange}
        singleDateMode={bookingType === AIRPORT_PICKUP_BOOKING_TYPE}
        isNightBooking={bookingType === NIGHT_BOOKING_TYPE}
        isFullDayBooking={bookingType === FULL_DAY_BOOKING_TYPE}
        isAirportPickup={bookingType === AIRPORT_PICKUP_BOOKING_TYPE}
      />

      {renderBookingTypeInput()}

      <Button className="w-full" onClick={handleSearch} disabled={isSearching}>
        {isSearching ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Searching...
          </>
        ) : (
          "Search"
        )}
      </Button>
    </div>
  );
}
