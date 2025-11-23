import { useSearchParams } from "@remix-run/react";
import { format } from "date-fns";
import { useCallback, useMemo, useState } from "react";
import { DateRange } from "react-day-picker";
import { getLagosTime } from "~/utils/timezone";
import { DateRangePicker } from "./booking/DateRangePicker";

import { BookingTimeSelect } from "./booking/BookingTimeSelect";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Button } from "./ui/button";

const DAY_BOOKING_TYPE = "DAY" as const;
const NIGHT_BOOKING_TYPE = "NIGHT" as const;
const FULL_DAY_BOOKING_TYPE = "FULL_DAY" as const;

const BOOKING_TYPE_OPTIONS = [DAY_BOOKING_TYPE, NIGHT_BOOKING_TYPE, FULL_DAY_BOOKING_TYPE] as const;

type BookingType = (typeof BOOKING_TYPE_OPTIONS)[number];

// Map tab values back to booking types
const TAB_VALUE_TO_BOOKING_TYPE: Record<string, BookingType> = {
  day: DAY_BOOKING_TYPE,
  night: NIGHT_BOOKING_TYPE,
  "full-day": FULL_DAY_BOOKING_TYPE,
};

const BOOKING_TYPE_OPTIONS_MAP = {
  [DAY_BOOKING_TYPE]: {
    label: "Day",
    duration: "12 hours",
    value: "day",
  },
  [NIGHT_BOOKING_TYPE]: {
    label: "Night",
    duration: "6 hours",
    value: "night",
  },
  [FULL_DAY_BOOKING_TYPE]: {
    label: "Full Day",
    duration: "24 hours",
    value: "full-day",
  },
} as const;

export function BookingSearch() {
  const [searchParams, setSearchParams] = useSearchParams();
  const bookingTypeParam = searchParams.get("bookingType");
  const isValidBookingType = (value: string | null): value is BookingType =>
    !!value && (BOOKING_TYPE_OPTIONS as readonly string[]).includes(value);
  const initialBookingType: BookingType = isValidBookingType(bookingTypeParam)
    ? bookingTypeParam
    : DAY_BOOKING_TYPE;
  const initialFrom = searchParams.get("from");
  const initialTo = searchParams.get("to");
  const initialPickupTime = searchParams.get("pickupTime") || undefined;

  const [bookingType, setBookingType] = useState<BookingType>(initialBookingType);
  const [dateRange, setDateRange] = useState<DateRange>({
    from: initialFrom ? new Date(`${initialFrom}T00:00:00Z`) : undefined,
    to: initialTo ? new Date(`${initialTo}T00:00:00Z`) : undefined,
  });
  const [pickupTime, setPickupTime] = useState<string | undefined>(initialPickupTime);

  const handleBookingTypeChange = useCallback(
    (tabValue: string) => {
      const newBookingType = TAB_VALUE_TO_BOOKING_TYPE[tabValue];
      if (newBookingType) {
        setBookingType(newBookingType);
        // Reset selected dates and pickup time when booking type changes
        setDateRange({ from: undefined, to: undefined });
        setPickupTime(undefined);

        // Update URL immediately so other components can react to booking type change
        const newSearchParams = new URLSearchParams(searchParams);
        newSearchParams.set("bookingType", newBookingType);
        newSearchParams.delete("from");
        newSearchParams.delete("to");
        newSearchParams.delete("pickupTime");
        setSearchParams(newSearchParams, { replace: true, preventScrollReset: true });
      }
    },
    [searchParams, setSearchParams],
  );

  const handlePickupTimeChange = useCallback((value: string) => {
    setPickupTime(value);
  }, []);

  const disableToday = useMemo(() => {
    if (bookingType === DAY_BOOKING_TYPE) {
      const nowLagos = getLagosTime();
      return nowLagos.getHours() > 11;
    }
    return false;
  }, [bookingType]);

  const handleDateRangeChange = (dateRange: DateRange) => {
    setDateRange(dateRange);
  };

  const handleSearch = useCallback(() => {
    const newSearchParams = new URLSearchParams();

    newSearchParams.set("bookingType", bookingType);

    if (dateRange.from) {
      newSearchParams.set("from", format(dateRange.from, "yyyy-MM-dd"));
    }
    if (dateRange.to) {
      newSearchParams.set("to", format(dateRange.to, "yyyy-MM-dd"));
    }
    if (pickupTime && bookingType !== NIGHT_BOOKING_TYPE) {
      newSearchParams.set("pickupTime", pickupTime);
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
        <TabsList className="p-2 gap-2 tabs-list-slider-3 w-full h-auto">
          {BOOKING_TYPE_OPTIONS.map((type) => {
            const option = BOOKING_TYPE_OPTIONS_MAP[type];
            return (
              <TabsTrigger
                key={option.value}
                className="flex flex-col data-[state=active]:shadow-none tabs-trigger-slider"
                value={option.value}
              >
                <span className="text-sm font-semibold">{option.label}</span>
                <span className="text-xs text-gray-600">{option.duration}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>
        {BOOKING_TYPE_OPTIONS.map((type) => (
          <TabsContent
            key={BOOKING_TYPE_OPTIONS_MAP[type].value}
            value={BOOKING_TYPE_OPTIONS_MAP[type].value}
          />
        ))}
      </Tabs>

      <DateRangePicker
        className="w-64"
        date={dateRange}
        onDateChange={handleDateRangeChange}
        singleDateMode={false}
        disableToday={disableToday}
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
          onValueChange={handlePickupTimeChange}
        />
      )}

      <Button className="w-full" onClick={handleSearch}>
        Search
      </Button>
    </div>
  );
}
