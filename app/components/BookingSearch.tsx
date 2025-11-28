import { useNavigation, useSearchParams } from "@remix-run/react";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DateRange } from "react-day-picker";
import { DateRangePicker } from "./booking/DateRangePicker";

import { BookingTimeSelect } from "./booking/BookingTimeSelect";
import { Button } from "./ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import {
  BookingType,
  BOOKING_TYPE_OPTIONS,
  DAY_BOOKING_TYPE,
  NIGHT_BOOKING_TYPE,
  FULL_DAY_BOOKING_TYPE,
  TAB_VALUE_TO_BOOKING_TYPE,
  BOOKING_TYPE_OPTIONS_MAP,
} from "./bookingTypes";

export function BookingSearch() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigation = useNavigation();
  const [isSearchClicked, setIsSearchClicked] = useState(false);

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

  // Use local state for form inputs (only sync to URL on Search button click or booking type change)
  const [bookingType, setBookingType] = useState<BookingType>(initialBookingType);
  const [dateRange, setDateRange] = useState<DateRange>({
    from: initialFrom ? new Date(`${initialFrom}T00:00:00Z`) : undefined,
    to: initialTo ? new Date(`${initialTo}T00:00:00Z`) : undefined,
  });
  const [pickupTime, setPickupTime] = useState<string | undefined>(initialPickupTime);

  // Sync state when URL changes (e.g., navigating back from car details page)
  useEffect(() => {
    const urlBookingType = searchParams.get("bookingType");
    const urlFrom = searchParams.get("from");
    const urlTo = searchParams.get("to");
    const urlPickupTime = searchParams.get("pickupTime");

    if (urlBookingType && isValidBookingType(urlBookingType)) {
      setBookingType(urlBookingType);
    }

    setDateRange({
      from: urlFrom ? new Date(`${urlFrom}T00:00:00Z`) : undefined,
      to: urlTo ? new Date(`${urlTo}T00:00:00Z`) : undefined,
    });

    setPickupTime(urlPickupTime || undefined);
  }, [searchParams, isValidBookingType]);

  const handleBookingTypeChange = useCallback(
    (tabValue: string) => {
      const newBookingType = TAB_VALUE_TO_BOOKING_TYPE[tabValue];
      if (newBookingType) {
        setBookingType(newBookingType);
        // Reset dates and pickup time when booking type changes
        setDateRange({ from: undefined, to: undefined });
        setPickupTime(undefined);

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

  const handleDateRangeChange = useCallback((newDateRange: DateRange) => {
    // Update local state only, don't update URL yet
    setDateRange(newDateRange);
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
    const effectivePickupTime = bookingType === NIGHT_BOOKING_TYPE ? "11 PM" : pickupTime;
    if (effectivePickupTime) {
      newSearchParams.set("pickupTime", effectivePickupTime);
    }

    setSearchParams(newSearchParams, { replace: true, preventScrollReset: true });
  }, [bookingType, dateRange, pickupTime, setSearchParams]);

  return (
    <div className="w-64 flex flex-col items-center justify-center gap-2 mt-4 mb-2">
      <Tabs
        className="w-full"
        value={BOOKING_TYPE_OPTIONS_MAP[bookingType].value}
        onValueChange={handleBookingTypeChange}
      >
        <TabsList className="p-2 gap-2 tabs-list-slider w-full h-auto before:w-[calc((100%-0.5rem)/3)]">
          {BOOKING_TYPE_OPTIONS.map((type) => {
            const option = BOOKING_TYPE_OPTIONS_MAP[type];
            return (
              <TabsTrigger
                key={option.value}
                className="flex flex-col data-[state=active]:shadow-none tabs-trigger-slider data-[state=active]:bg-transparent"
                value={option.value}
              >
                <span className="text-sm font-semibold">{option.label}</span>
                <span className="text-xs text-gray-600">{option.duration}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      <DateRangePicker
        className="w-64"
        date={dateRange}
        onDateChange={handleDateRangeChange}
        singleDateMode={false}
        isNightBooking={bookingType === NIGHT_BOOKING_TYPE}
        isFullDayBooking={bookingType === FULL_DAY_BOOKING_TYPE}
      />

      {bookingType === NIGHT_BOOKING_TYPE ? (
        <p className="text-xs text-gray-600 h-10 items-center flex">
          Night bookings start at 11pm and end at 5am.
        </p>
      ) : (
        <BookingTimeSelect
          key={bookingType}
          date={dateRange.from ?? new Date()}
          bookingType={bookingType}
          defaultValue={pickupTime}
          onValueChange={handlePickupTimeChange}
        />
      )}

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
