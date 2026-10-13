import { cn } from "cn";
import { useId } from "react";
import type { SearchFlight } from "~/api/flights/schema";
import { formatFlightRoute, formatLagosClock } from "~/booking/airport-pickup";
import { FlightNumberAutocomplete } from "~/booking/booking-flight-field";
import { BookingTimeSelect } from "~/booking/booking-time-select";
import { AIRPORT_PICKUP_BOOKING_TYPE, type BookingType, NIGHT_BOOKING_TYPE } from "~/booking/types";

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
  readonly presentation?: "card" | "compact";
}

interface AirportPickupInputProps {
  readonly flightNumber: string;
  readonly validatedFlight: SearchFlight | null;
  readonly flightError: string | null;
  readonly onFlightNumberChange?: (value: string) => void;
  readonly onFlightNumberBlur?: (value: string) => void;
  readonly isCompact: boolean;
  readonly containerClassName: string;
  readonly labelClassName: string;
}

interface FlightStatusProps {
  readonly validatedFlight: SearchFlight | null;
  readonly flightError: string | null;
}

function FlightStatus({ validatedFlight, flightError }: FlightStatusProps) {
  if (validatedFlight == null && flightError == null) {
    return null;
  }

  const route = validatedFlight ? formatFlightRoute(validatedFlight) : null;
  const time = validatedFlight ? formatLagosClock(validatedFlight.arrivalTime) : null;

  return (
    <span className="min-w-0 truncate text-xs leading-none whitespace-nowrap" aria-live="polite">
      {route && time ? (
        <span className="text-green-600">
          {route} • {time}
        </span>
      ) : (
        <span className="text-gray-500">{flightError}</span>
      )}
    </span>
  );
}

function AirportPickupInput({
  flightNumber,
  validatedFlight,
  flightError,
  onFlightNumberChange,
  onFlightNumberBlur,
  isCompact,
  containerClassName,
  labelClassName,
}: AirportPickupInputProps) {
  const flightNumberId = useId();

  return (
    <div className={cn("w-full", isCompact && "h-full")}>
      <FlightNumberAutocomplete
        id={flightNumberId}
        value={flightNumber}
        onChange={(next) => onFlightNumberChange?.(next)}
        onBlur={onFlightNumberBlur}
        placeholder="E.g BA123"
        anchor={(trigger) => (
          <div className={containerClassName}>
            <label htmlFor={flightNumberId} className={labelClassName}>
              Flight number
            </label>
            <div
              className={cn(
                "flex h-4 min-w-0 items-center gap-2",
                isCompact ? "w-full" : "flex-1 justify-end",
              )}
            >
              <FlightStatus validatedFlight={validatedFlight} flightError={flightError} />
              {trigger}
            </div>
          </div>
        )}
        className={cn(
          "h-4 max-h-4 min-h-0 w-auto min-w-0 shrink-0 cursor-text border-0 bg-transparent p-0 text-sm leading-none font-normal text-gray-800 shadow-none outline-none placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-ring/50",
          isCompact ? "max-w-full" : "field-sizing-content max-w-full text-right",
        )}
      />
    </div>
  );
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
  presentation = "card",
}: BookingTypeInputProps) {
  const isCompact = presentation === "compact";
  const containerClassName = cn(
    isCompact
      ? "flex h-full min-w-0 flex-col items-start justify-center gap-2 overflow-hidden px-3 py-2"
      : "flex h-8 w-full items-center justify-between gap-4 overflow-hidden py-2",
  );
  const labelClassName = "shrink-0 text-sm leading-none font-semibold text-gray-800";
  const valueClassName = cn(
    "min-w-0 text-sm leading-none font-normal",
    isCompact ? "w-full justify-start" : "w-auto justify-end text-right",
  );

  if (bookingType === NIGHT_BOOKING_TYPE) {
    return (
      <div className={containerClassName}>
        <div className={labelClassName}>{isCompact ? "Pickup" : "Time"}</div>
        <div className="text-sm leading-none font-normal h-4 text-gray-800">11:00 PM</div>
      </div>
    );
  }

  if (bookingType === AIRPORT_PICKUP_BOOKING_TYPE) {
    return (
      <AirportPickupInput
        flightNumber={flightNumber}
        validatedFlight={validatedFlight}
        flightError={flightError}
        onFlightNumberChange={onFlightNumberChange}
        onFlightNumberBlur={onFlightNumberBlur}
        isCompact={isCompact}
        containerClassName={containerClassName}
        labelClassName={labelClassName}
      />
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
      containerClassName={containerClassName}
      labelClassName={labelClassName}
      label={isCompact ? "Pickup" : "Time"}
      className={cn(valueClassName, "[&_svg]:block", !isCompact && "[&_svg]:-rotate-90")}
      showLabel
      placeholder={isCompact ? "Select time" : "Select pickup time"}
    />
  );
}
