import { useNavigate, useNavigation, useSearchParams } from "@remix-run/react";
import { format } from "date-fns";
import { Loader2, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { DateRange } from "react-day-picker";
import { DateRangePicker } from "./booking/DateRangePicker";

import { formatInTimeZone } from "date-fns-tz";
import type { ValidatedFlight } from "~/services/flight-validation.server";
import { LAGOS_TIMEZONE } from "~/utils/timezone";
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

interface BookingTypeTabsProps {
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly variant: "expanded" | "compact";
  readonly context?: "hero" | "modal";
}

function BookingTypeTabs({
  value,
  onValueChange,
  variant,
  context = "hero",
}: BookingTypeTabsProps) {
  const isCompact = variant === "compact";
  const isModal = context === "modal";

  if (isCompact) {
    return (
      <Tabs value={value} onValueChange={onValueChange}>
        <TabsList className="h-7 p-0.5 gap-0.5 bg-gray-100 rounded-full">
          {BOOKING_TYPE_OPTIONS.map((type) => {
            const option = BOOKING_TYPE_OPTIONS_MAP[type];
            return (
              <TabsTrigger
                key={option.value}
                className="h-6 px-2.5 text-xs font-medium rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm"
                value={option.value}
              >
                {option.label}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>
    );
  }

  return (
    <Tabs className="w-full" value={value} onValueChange={onValueChange}>
      <TabsList
        className={`p-1 gap-1 tabs-list-slider w-full h-auto before:w-[calc((100%-0.75rem)/4)] rounded-lg ${
          isModal
            ? "bg-gray-100 border border-gray-200"
            : "bg-white/10 backdrop-blur-sm border border-white/20"
        }`}
      >
        {BOOKING_TYPE_OPTIONS.map((type) => {
          const option = BOOKING_TYPE_OPTIONS_MAP[type];
          return (
            <TabsTrigger
              key={option.value}
              className={`flex flex-col items-center justify-center min-w-0 data-[state=active]:shadow-none tabs-trigger-slider data-[state=active]:bg-white py-2 px-1 ${
                isModal
                  ? "data-[state=active]:text-foreground text-gray-700"
                  : "data-[state=active]:text-foreground text-white/90"
              }`}
              value={option.value}
            >
              <span className="text-sm font-semibold text-center whitespace-nowrap">
                {option.label}
              </span>
              <span className="text-xs opacity-80 text-center whitespace-nowrap">
                {option.duration}
              </span>
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}

interface BookingTypeInputProps {
  readonly bookingType: BookingType;
  readonly pickupTime: string | undefined;
  readonly flightNumber: string | undefined;
  readonly dateRange: DateRange;
  readonly onPickupTimeChange: (value: string) => void;
  readonly onFlightNumberChange: (value: string) => void;
  readonly onFlightNumberSelect: (value: string) => void;
  readonly onFlightValidated: (flight: ValidatedFlight | null) => void;
  readonly onValidationError: (message: string | null, isWarning: boolean) => void;
  readonly validatedFlight?: ValidatedFlight | null;
  readonly validationMessage?: string | null;
}

function BookingTypeInput({
  bookingType,
  pickupTime,
  flightNumber,
  dateRange,
  onPickupTimeChange,
  onFlightNumberChange,
  onFlightNumberSelect,
  onFlightValidated,
  onValidationError,
  validatedFlight,
  validationMessage,
}: BookingTypeInputProps) {
  const containerClass = "w-full h-[38px] flex flex-col justify-center";
  const labelClass = "text-xs font-semibold text-gray-700 leading-tight";
  const valueClass = "text-sm text-gray-900 leading-tight";

  if (bookingType === NIGHT_BOOKING_TYPE) {
    return (
      <div className={containerClass}>
        <div className={labelClass}>Pickup Time</div>
        <div className={valueClass}>11:00 PM</div>
      </div>
    );
  }

  if (bookingType === AIRPORT_PICKUP_BOOKING_TYPE) {
    // Build validation notice content
    let validationContent: React.ReactNode = null;
    if (validatedFlight) {
      const arrivalTime = formatInTimeZone(
        new Date(
          validatedFlight.actualArrival ??
            validatedFlight.estimatedArrival ??
            validatedFlight.scheduledArrival,
        ),
        LAGOS_TIMEZONE,
        "h:mm a",
      );
      validationContent = (
        <span className="text-green-600">
          ✓ {validatedFlight.originIATA || validatedFlight.origin} →{" "}
          {validatedFlight.destinationIATA || validatedFlight.destination} • {arrivalTime}
        </span>
      );
    } else if (validationMessage) {
      validationContent = <span className="text-gray-500">{validationMessage}</span>;
    }

    return (
      <div className={containerClass}>
        {/* Two-column layout: left (label+input), right (validation message) */}
        <div className="flex items-start gap-2">
          {/* Left column: Label + Input - takes full width when no message */}
          <div className={`flex flex-col min-w-0 ${validationContent ? "w-[45%]" : "flex-1"}`}>
            <span className={labelClass}>Flight Number</span>
            <AutocompleteFlight
              id="flightNumber"
              onSelect={onFlightNumberSelect}
              inputProps={{
                value: flightNumber || "",
                onChange: (e) => onFlightNumberChange(e.target.value),
                placeholder: "e.g. BA123",
              }}
              initialValue={flightNumber}
              className="w-full h-5 placeholder-gray-400 border-0 px-0 py-0 focus:ring-0 shadow-none bg-transparent hover:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-sm leading-tight"
              nigeriaOnly={true}
              pickupDate={
                dateRange.from
                  ? formatInTimeZone(dateRange.from, LAGOS_TIMEZONE, "yyyy-MM-dd")
                  : undefined
              }
              showValidation={false}
              onFlightValidated={onFlightValidated}
              onValidationError={onValidationError}
            />
          </div>
          {/* Right column: Validation message */}
          {validationContent && (
            <div className="flex-1 text-xs leading-tight text-right pt-0.5">
              {validationContent}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <BookingTimeSelect
      key={bookingType}
      date={dateRange.from ?? new Date()}
      bookingType={bookingType}
      defaultValue={pickupTime}
      onValueChange={onPickupTimeChange}
      containerClassName={containerClass}
      labelClassName={labelClass}
      showLabel={true}
    />
  );
}

interface SearchButtonProps {
  readonly isCompact: boolean;
  readonly isSearching: boolean;
  readonly onClick: () => void;
}

function SearchButton({ isCompact, isSearching, onClick }: SearchButtonProps) {
  const containerClass = isCompact
    ? "flex-none py-2 pl-2 pr-2"
    : "px-4 sm:px-3 py-3 md:py-2 border-t md:border-t-0";

  const buttonClass = isCompact
    ? "h-9 w-9 p-0"
    : "w-full md:w-auto h-12 md:h-12 px-6 md:px-8 text-sm md:text-base";

  const iconClass = isCompact ? "h-4 w-4" : "h-5 w-5";

  return (
    <div className={`flex items-center justify-center ${containerClass}`}>
      <Button
        className={`rounded-full font-semibold bg-primary hover:bg-primary/90 transition-all duration-300 ${buttonClass}`}
        onClick={onClick}
        disabled={isSearching}
      >
        {isSearching ? (
          <>
            <Loader2 className={`${iconClass} animate-spin`} />
            {!isCompact && <span className="ml-2 md:hidden">Searching...</span>}
          </>
        ) : (
          <>
            <Search className={isCompact ? iconClass : `${iconClass} mr-2`} aria-label="Search" />
            {!isCompact && <span className="ml-2 md:hidden">Search</span>}
          </>
        )}
      </Button>
    </div>
  );
}

interface BookingSearchProps {
  readonly isCompact?: boolean;
  readonly context?: "hero" | "modal";
  /** When true, navigates to /search route instead of updating current page URL params */
  readonly navigateToSearch?: boolean;
  /** Called after search is triggered (useful for closing modals) */
  readonly onSearchComplete?: () => void;
}

export function BookingSearch({
  isCompact = false,
  context = "hero",
  navigateToSearch = false,
  onSearchComplete,
}: BookingSearchProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const [isSearchClicked, setIsSearchClicked] = useState(false);
  const [validatedFlight, setValidatedFlight] = useState<ValidatedFlight | null>(null);
  const [flightValidationError, setFlightValidationError] = useState<string | null>(null);

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
    // Parse without Z suffix to treat as local midnight, preserving the calendar date
    from: initialFrom ? new Date(`${initialFrom}T00:00:00`) : undefined,
    to: initialTo ? new Date(`${initialTo}T00:00:00`) : undefined,
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
      // Parse without Z suffix to treat as local midnight, preserving the calendar date
      from: urlFrom ? new Date(`${urlFrom}T00:00:00`) : undefined,
      to: urlTo ? new Date(`${urlTo}T00:00:00`) : undefined,
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

        // Only update URL if not navigating to /search (homepage should stay clean)
        if (!navigateToSearch) {
          const newSearchParams = new URLSearchParams();
          newSearchParams.set("bookingType", newBookingType);
          setSearchParams(newSearchParams, { replace: true, preventScrollReset: true });
        }
      }
    },
    [navigateToSearch, setSearchParams],
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
  }, []);

  const handleFlightValidated = useCallback((flight: ValidatedFlight | null) => {
    setValidatedFlight(flight);
    setFlightValidationError(null);
  }, []);

  const handleValidationError = useCallback((message: string | null, _isWarning: boolean) => {
    setFlightValidationError(message);
  }, []);

  const handleSearch = useCallback(() => {
    // Set flag to show loading indicator
    setIsSearchClicked(true);

    // Start with existing filter params (serviceTier, vehicleType) to preserve them
    const newSearchParams = new URLSearchParams();

    // Preserve existing category filters when on search page
    const existingServiceTier = searchParams.get("serviceTier");
    const existingVehicleType = searchParams.get("vehicleType");
    if (existingServiceTier) {
      newSearchParams.set("serviceTier", existingServiceTier);
    }
    if (existingVehicleType) {
      newSearchParams.set("vehicleType", existingVehicleType);
    }

    // Set booking params
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

    // Navigate to /search route or update current page params
    if (navigateToSearch) {
      navigate(`/search?${newSearchParams.toString()}`);
    } else {
      setSearchParams(newSearchParams, { replace: true, preventScrollReset: true });
    }

    onSearchComplete?.();
  }, [
    bookingType,
    dateRange,
    pickupTime,
    flightNumber,
    navigateToSearch,
    navigate,
    setSearchParams,
    searchParams,
    onSearchComplete,
  ]);

  const bookingTypeInputProps = {
    bookingType,
    pickupTime,
    flightNumber,
    dateRange,
    onPickupTimeChange: handlePickupTimeChange,
    onFlightNumberChange: handleFlightNumberChange,
    onFlightNumberSelect: handleFlightNumberSelect,
    onFlightValidated: handleFlightValidated,
    onValidationError: handleValidationError,
    validatedFlight,
    validationMessage: flightValidationError,
  };

  return (
    <div className="w-full">
      {/* Booking Type Tabs - Above the pill, hidden when compact */}
      <div
        className={`transition-all duration-300 overflow-hidden ${
          isCompact ? "opacity-0 max-h-0 mb-0" : "opacity-100 max-h-24 mb-4"
        }`}
      >
        <BookingTypeTabs
          value={BOOKING_TYPE_OPTIONS_MAP[bookingType].value}
          onValueChange={handleBookingTypeChange}
          variant="expanded"
          context={context}
        />
      </div>

      {/* Airbnb-style Pill Search */}
      <div className="w-full">
        <div
          className={`bg-white border border-gray-200 transition-all duration-300 ${
            isCompact
              ? "rounded-full shadow-md hover:shadow-lg"
              : "rounded-3xl md:rounded-full shadow-2xl hover:shadow-xl"
          }`}
        >
          <div
            className={`flex items-stretch ${
              isCompact
                ? "flex-row divide-x divide-gray-300"
                : "flex-col md:flex-row md:divide-x md:divide-gray-200"
            }`}
          >
            {/* Compact Booking Type Selector - Only visible when compact */}
            {isCompact && (
              <div className="flex-none flex items-center pl-4 pr-3 py-2">
                <BookingTypeTabs
                  value={BOOKING_TYPE_OPTIONS_MAP[bookingType].value}
                  onValueChange={handleBookingTypeChange}
                  variant="compact"
                />
              </div>
            )}

            {/* Dates & Pickup Time Group - Equal widths in compact mode */}
            {isCompact ? (
              <div className="flex-1 flex items-stretch divide-x divide-gray-300">
                {/* Dates Section */}
                <div className="flex-1 flex items-center px-3 py-2">
                  <DateRangePicker
                    className="w-full"
                    date={dateRange}
                    onDateChange={handleDateRangeChange}
                    singleDateMode={bookingType === AIRPORT_PICKUP_BOOKING_TYPE}
                    isNightBooking={bookingType === NIGHT_BOOKING_TYPE}
                    isFullDayBooking={bookingType === FULL_DAY_BOOKING_TYPE}
                    isAirportPickup={bookingType === AIRPORT_PICKUP_BOOKING_TYPE}
                    isCompact={isCompact}
                  />
                </div>
                {/* Pickup Time / Flight Number Section */}
                <div className="flex-1 flex items-center px-3 py-2">
                  <BookingTypeInput {...bookingTypeInputProps} />
                </div>
              </div>
            ) : (
              <>
                {/* Dates Section */}
                <div className="flex-1 flex items-center px-4 sm:px-6 py-3 min-h-[60px]">
                  <DateRangePicker
                    className="w-full"
                    date={dateRange}
                    onDateChange={handleDateRangeChange}
                    singleDateMode={bookingType === AIRPORT_PICKUP_BOOKING_TYPE}
                    isNightBooking={bookingType === NIGHT_BOOKING_TYPE}
                    isFullDayBooking={bookingType === FULL_DAY_BOOKING_TYPE}
                    isAirportPickup={bookingType === AIRPORT_PICKUP_BOOKING_TYPE}
                    isCompact={isCompact}
                  />
                </div>
                {/* Pickup Time / Flight Number Section */}
                <div className="flex-1 flex items-center px-4 sm:px-6 py-3 border-t md:border-t-0 min-h-[60px]">
                  <BookingTypeInput {...bookingTypeInputProps} />
                </div>
              </>
            )}

            <SearchButton isCompact={isCompact} isSearching={isSearching} onClick={handleSearch} />
          </div>
        </div>
      </div>
    </div>
  );
}
