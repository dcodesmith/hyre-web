import { useState } from "react";
import { Form, useSearchParams } from "react-router";

import { BookingTypeInput } from "~/components/booking/booking-type-input";
import { BookingTypeTabs } from "~/components/booking/booking-type-tabs";
import { SearchButton } from "~/components/booking/search-button";
import { SingleDatePicker } from "~/components/booking/single-date-picker";
import {
  AIRPORT_PICKUP_BOOKING_TYPE,
  BOOKING_TYPE_OPTIONS,
  type BookingType,
  NIGHT_BOOKING_TYPE,
} from "~/lib/booking-types";
import {
  getToDateMinDate,
  isValidToDateSelection,
  nextPickupTimeOnFromChange,
  nextToDateOnFromChange,
} from "~/lib/booking-utils";
import { formatZonedDate } from "~/lib/timezone";

function isBookingType(value: string | null): value is BookingType {
  return value !== null && (BOOKING_TYPE_OPTIONS as readonly string[]).includes(value);
}

interface AirportSearchFieldsProps {
  readonly fromDate: Date | undefined;
  readonly flightNumber: string;
  readonly fallbackDate: Date;
  readonly onFromDateChange: (date: Date | undefined) => void;
  readonly onFlightNumberChange: (value: string) => void;
}

interface StandardSearchFieldsProps {
  readonly bookingType: BookingType;
  readonly fromDate: Date | undefined;
  readonly toDate: Date | undefined;
  readonly pickupTime: string | undefined;
  readonly fallbackDate: Date;
  readonly onFromDateChange: (date: Date | undefined) => void;
  readonly onToDateChange: (date: Date | undefined) => void;
  readonly onPickupTimeChange: (value: string) => void;
}

function AirportSearchFields({
  fromDate,
  flightNumber,
  fallbackDate,
  onFromDateChange,
  onFlightNumberChange,
}: AirportSearchFieldsProps) {
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
  bookingType,
  fromDate,
  toDate,
  pickupTime,
  fallbackDate,
  onFromDateChange,
  onToDateChange,
  onPickupTimeChange,
}: StandardSearchFieldsProps) {
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

function HomeSearchFields({ initialBookingType }: { readonly initialBookingType: BookingType }) {
  const [bookingType, setBookingType] = useState<BookingType>(initialBookingType);
  const [fromDate, setFromDate] = useState<Date | undefined>();
  const [toDate, setToDate] = useState<Date | undefined>();
  const [pickupTime, setPickupTime] = useState<string | undefined>();
  const [flightNumber, setFlightNumber] = useState("");
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
    <Form method="get" action="/search" className="w-full text-left">
      <input type="hidden" name="bookingType" value={bookingType} />
      {fromDate ? <input type="hidden" name="from" value={formatZonedDate(fromDate)} /> : null}
      {toDate ? <input type="hidden" name="to" value={formatZonedDate(toDate)} /> : null}
      {isAirportPickup ? <input type="hidden" name="flightNumber" value={flightNumber} /> : null}
      {isNight ? <input type="hidden" name="pickupTime" value="11 PM" /> : null}

      <BookingTypeTabs value={bookingType} onValueChange={handleBookingTypeChange} />

      <div className="w-full">
        <div className="rounded-3xl border border-gray-200 bg-white shadow-2xl transition-shadow duration-300 hover:shadow-xl md:rounded-full">
          <div className="flex flex-col items-stretch md:flex-row">
            {isAirportPickup ? (
              <AirportSearchFields
                fromDate={fromDate}
                flightNumber={flightNumber}
                fallbackDate={fallbackDate}
                onFromDateChange={handleFromDateChange}
                onFlightNumberChange={setFlightNumber}
              />
            ) : (
              <StandardSearchFields
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
            <SearchButton />
          </div>
        </div>
      </div>
    </Form>
  );
}

export function HomeSearch() {
  const [searchParams] = useSearchParams();
  const requestedBookingType = searchParams.get("bookingType");
  const initialBookingType = isBookingType(requestedBookingType) ? requestedBookingType : "DAY";

  return <HomeSearchFields key={initialBookingType} initialBookingType={initialBookingType} />;
}
