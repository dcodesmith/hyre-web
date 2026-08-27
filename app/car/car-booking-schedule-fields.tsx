import { BookingFlightField } from "~/booking/booking-flight-field";
import { BookingLocationFields } from "~/booking/booking-location-fields";
import { BookingTimeSelect } from "~/booking/booking-time-select";
import { BookingTypeTabs } from "~/booking/booking-type-tabs";
import { getToDateMinDate } from "~/booking/dates";
import { SingleDatePicker } from "~/booking/single-date-picker";
import { NIGHT_BOOKING_TYPE } from "~/booking/types";
import type { useCarBookingCard } from "~/car/use-car-booking-card";
import { Label } from "~/components/ui/label";

type CardState = Pick<
  ReturnType<typeof useCarBookingCard>,
  | "bookingType"
  | "dropOffAddress"
  | "fallbackDate"
  | "flightNumber"
  | "fromDate"
  | "handleBookingTypeChange"
  | "handleDropOffAddressSelect"
  | "handleDropOffAddressInput"
  | "handleFlightBlur"
  | "handleFlightNumberChange"
  | "handleFromDateChange"
  | "handlePickupAddressSelect"
  | "handlePickupAddressInput"
  | "handlePickupTimeChange"
  | "handleSameLocationChange"
  | "handleToDateChange"
  | "hasCompleteDates"
  | "ids"
  | "isAirportPickup"
  | "nightHelper"
  | "pickupAddress"
  | "pickupIsReadOnly"
  | "pickupTime"
  | "sameLocation"
  | "showDropOff"
  | "toDate"
>;

function BookingDatesRow({ card }: { readonly card: CardState }) {
  if (card.isAirportPickup) {
    return (
      <SingleDatePicker
        bookingType={card.bookingType}
        date={card.fromDate}
        onDateChange={card.handleFromDateChange}
        showLabel={false}
      />
    );
  }

  return (
    <div className="flex gap-2">
      <SingleDatePicker
        className="flex-1"
        bookingType={card.bookingType}
        date={card.fromDate}
        onDateChange={card.handleFromDateChange}
        showLabel={false}
        placeholder="From date"
      />
      <SingleDatePicker
        className="flex-1"
        bookingType={card.bookingType}
        date={card.toDate}
        onDateChange={card.handleToDateChange}
        minDate={getToDateMinDate(card.bookingType, card.fromDate)}
        showLabel={false}
        placeholder="To date"
        disabled={!card.fromDate}
      />
    </div>
  );
}

function BookingTripFields({
  card,
  flight,
  flightError,
  flightWarning,
  isValidatingFlight,
}: {
  readonly card: CardState;
  readonly flight: Parameters<typeof BookingFlightField>[0]["flight"];
  readonly flightError: string | null;
  readonly flightWarning: string | null;
  readonly isValidatingFlight: boolean;
}) {
  if (!card.hasCompleteDates) {
    return null;
  }

  if (card.isAirportPickup) {
    return (
      <BookingFlightField
        id={card.ids.flightNumberId}
        value={card.flightNumber}
        flight={flight}
        error={flightError}
        warning={flightWarning}
        isValidating={isValidatingFlight}
        onChange={card.handleFlightNumberChange}
        onBlur={card.handleFlightBlur}
      />
    );
  }

  if (card.bookingType === NIGHT_BOOKING_TYPE) {
    return null;
  }

  return (
    <div className="space-y-1">
      <Label htmlFor={card.ids.pickupTimeId} className="block font-semibold leading-5">
        Pickup Time
      </Label>
      <BookingTimeSelect
        key={`${card.bookingType}-${card.fromDate?.toISOString()}`}
        id={card.ids.pickupTimeId}
        date={card.fromDate ?? card.fallbackDate}
        bookingType={card.bookingType}
        value={card.pickupTime}
        onValueChange={card.handlePickupTimeChange}
      />
    </div>
  );
}

export function CarBookingScheduleFields({
  card,
  flight,
  flightError,
  flightWarning,
  isValidatingFlight,
}: {
  readonly card: CardState;
  readonly flight: Parameters<typeof BookingFlightField>[0]["flight"];
  readonly flightError: string | null;
  readonly flightWarning: string | null;
  readonly isValidatingFlight: boolean;
}) {
  return (
    <>
      <div className="space-y-1">
        <Label className="block font-semibold leading-5">Booking Type</Label>
        <BookingTypeTabs
          value={card.bookingType}
          onValueChange={card.handleBookingTypeChange}
          variant="modal"
        />
      </div>

      <div className="space-y-1">
        <Label className="block font-semibold leading-5">
          {card.isAirportPickup ? "Select Date" : "Select Dates"}
        </Label>
        <BookingDatesRow card={card} />
      </div>

      <BookingTripFields
        card={card}
        flight={flight}
        flightError={flightError}
        flightWarning={flightWarning}
        isValidatingFlight={isValidatingFlight}
      />

      {card.hasCompleteDates ? (
        <BookingLocationFields
          pickupAddressId={card.ids.pickupAddressId}
          dropOffAddressId={card.ids.dropOffAddressId}
          sameLocationId={card.ids.sameLocationId}
          pickupAddress={card.pickupAddress}
          dropOffAddress={card.dropOffAddress}
          sameLocation={card.sameLocation}
          isAirportPickup={card.isAirportPickup}
          pickupIsReadOnly={card.pickupIsReadOnly}
          showDropOff={card.showDropOff}
          nightHelper={card.nightHelper}
          onPickupAddressSelect={card.handlePickupAddressSelect}
          onPickupAddressInput={card.handlePickupAddressInput}
          onDropOffAddressSelect={card.handleDropOffAddressSelect}
          onDropOffAddressInput={card.handleDropOffAddressInput}
          onSameLocationChange={card.handleSameLocationChange}
        />
      ) : null}
    </>
  );
}
