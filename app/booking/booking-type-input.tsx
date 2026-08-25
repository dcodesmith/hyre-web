import { useId } from "react";

import type { SearchFlight } from "~/api/flights/schema";
import { formatFlightRoute, formatLagosClock } from "~/booking/airport-pickup";
import { FlightNumberAutocomplete } from "~/booking/booking-flight-field";
import { BookingTimeSelect } from "~/booking/booking-time-select";
import { AIRPORT_PICKUP_BOOKING_TYPE, type BookingType, NIGHT_BOOKING_TYPE } from "~/booking/types";
import { cn } from "~/lib/utils";

export const bookingFieldLabelClass = "text-xs font-semibold leading-tight text-gray-700";
export const bookingFieldValueTextClass = "text-sm leading-tight text-gray-900";
export const bookingFieldStackClass = "flex h-[38px] w-full flex-col justify-center text-left";

interface BookingTypeInputProps {
  readonly bookingType: BookingType;
  readonly pickupTime: string | undefined;
  readonly flightNumber: string;
  readonly fromDate: Date | undefined;
  readonly fallbackDate: Date;
  readonly validatedFlight?: SearchFlight | null;
  readonly flightError?: string | null;
  readonly onPickupTimeChange?: (value: string) => void;
  readonly onFlightNumberChange?: (value: string) => void;
  readonly onFlightNumberBlur?: (value: string) => void;
  readonly isCompact?: boolean;
}

export function BookingTypeInput({
  bookingType,
  pickupTime,
  flightNumber,
  fromDate,
  fallbackDate,
  validatedFlight = null,
  flightError = null,
  onPickupTimeChange,
  onFlightNumberChange,
  onFlightNumberBlur,
  isCompact = false,
}: BookingTypeInputProps) {
  const flightNumberId = useId();
  const hasStatus = validatedFlight != null || flightError != null;

  if (bookingType === NIGHT_BOOKING_TYPE) {
    return (
      <div className={bookingFieldStackClass}>
        <div className={bookingFieldLabelClass}>Pickup Time</div>
        <div className={bookingFieldValueTextClass}>11:00 PM</div>
      </div>
    );
  }

  if (bookingType === AIRPORT_PICKUP_BOOKING_TYPE) {
    const route = validatedFlight ? formatFlightRoute(validatedFlight) : null;
    const time = validatedFlight ? formatLagosClock(validatedFlight.arrivalTime) : null;

    return (
      <div className={bookingFieldStackClass}>
        <div className="flex items-start gap-2">
          <div className={cn("flex min-w-0 flex-col", hasStatus ? "w-[45%]" : "flex-1")}>
            <label htmlFor={flightNumberId} className={bookingFieldLabelClass}>
              Flight Number
            </label>
            <FlightNumberAutocomplete
              id={flightNumberId}
              value={flightNumber}
              onChange={(next) => onFlightNumberChange?.(next)}
              onBlur={onFlightNumberBlur}
              placeholder="e.g. BA123…"
              className="w-full cursor-text border-0 bg-transparent p-0 text-sm leading-tight text-gray-900 shadow-none outline-none placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-ring/50"
            />
          </div>
          {hasStatus ? (
            <div
              className="min-w-0 flex-1 break-words pt-0.5 text-right text-xs leading-tight"
              aria-live="polite"
            >
              {route && time ? (
                <span className="text-green-600">
                  <span className="sm:hidden">
                    {route} • {time}
                  </span>
                  <span className="hidden sm:block">
                    <span className="block">{route}</span>
                    <span className="block">{time}</span>
                  </span>
                </span>
              ) : (
                <span className="text-gray-500">{flightError}</span>
              )}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <BookingTimeSelect
      key={`${bookingType}-${fromDate?.toISOString()}`}
      date={fromDate ?? fallbackDate}
      bookingType={bookingType}
      value={pickupTime}
      onValueChange={onPickupTimeChange}
      name="pickupTime"
      containerClassName={bookingFieldStackClass}
      labelClassName={bookingFieldLabelClass}
      showLabel
      placeholder={isCompact ? "Select time" : "Select pickup time…"}
    />
  );
}
