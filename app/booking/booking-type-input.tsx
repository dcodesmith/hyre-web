import { BookingTimeSelect } from "~/booking/booking-time-select";
import { AIRPORT_PICKUP_BOOKING_TYPE, type BookingType, NIGHT_BOOKING_TYPE } from "~/booking/types";

export const bookingFieldLabelClass = "text-xs font-semibold leading-tight text-gray-700";
export const bookingFieldValueTextClass = "text-sm leading-tight text-gray-900";
export const bookingFieldStackClass = "flex h-[38px] w-full flex-col justify-center text-left";

interface BookingTypeInputProps {
  readonly bookingType: BookingType;
  readonly pickupTime: string | undefined;
  readonly flightNumber: string;
  readonly fromDate: Date | undefined;
  readonly fallbackDate: Date;
  readonly onPickupTimeChange?: (value: string) => void;
  readonly onFlightNumberChange?: (value: string) => void;
  readonly isCompact?: boolean;
}

export function BookingTypeInput({
  bookingType,
  pickupTime,
  flightNumber,
  fromDate,
  fallbackDate,
  onPickupTimeChange,
  onFlightNumberChange,
  isCompact = false,
}: BookingTypeInputProps) {
  if (bookingType === NIGHT_BOOKING_TYPE) {
    return (
      <div className={bookingFieldStackClass}>
        <div className={bookingFieldLabelClass}>Pickup Time</div>
        <div className={bookingFieldValueTextClass}>11:00 PM</div>
      </div>
    );
  }

  if (bookingType === AIRPORT_PICKUP_BOOKING_TYPE) {
    return (
      <label className={bookingFieldStackClass}>
        <span className={bookingFieldLabelClass}>Flight Number</span>
        <input
          type="text"
          value={flightNumber}
          onChange={(event) => onFlightNumberChange?.(event.target.value)}
          placeholder="e.g. BA123…"
          autoComplete="off"
          spellCheck={false}
          className="w-full cursor-text bg-transparent p-0 text-sm leading-tight text-gray-900 outline-none placeholder:text-gray-400"
        />
      </label>
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
