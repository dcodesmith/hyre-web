import { type FieldMetadata, getInputProps } from "@conform-to/react";
import { type DateRange } from "react-day-picker";
import type { ValidatedFlight } from "~/services/flight-validation.server";
import { AutocompleteAddress } from "../AutocompleteAddress";
import { AutocompleteFlight } from "../AutocompleteFlight";
import { AIRPORT_PICKUP_BOOKING_TYPE, BookingType, NIGHT_BOOKING_TYPE } from "../bookingTypes";
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { BookingTimeSelect } from "./BookingTimeSelect";

interface BookingFormFieldsProps {
  readonly bookingType: BookingType;
  readonly dateRange: DateRange;
  readonly fallbackDate: Date;
  readonly fields: {
    pickupTime: FieldMetadata<string>;
    flightNumber?: FieldMetadata<string>;
    pickupAddress: FieldMetadata<string>;
    dropOffAddress: FieldMetadata<string>;
    sameLocation: FieldMetadata<string>;
  };
  readonly sameLocationChecked: boolean;
  readonly formId: string;
  readonly errorRingClasses: string;
  readonly nightBookingHelperText: string | null;
  readonly onPickupTimeChange: (value: string) => void;
  readonly onSameLocationChange: (checked: boolean) => void;
  readonly onAddressUpdate: (name: string, value: string) => void;
  readonly validatedFlight?: ValidatedFlight | null;
  readonly onFlightValidated?: (flight: ValidatedFlight | null) => void;
}

function FieldError({ errors }: { readonly errors?: readonly string[] }) {
  if (!errors || errors.length === 0) {
    return null;
  }
  return <p className="text-red-500 text-sm mt-1">{errors.join(", ")}</p>;
}

type TimeOrFlightFieldProps = Readonly<
  Pick<
    BookingFormFieldsProps,
    | "bookingType"
    | "dateRange"
    | "fallbackDate"
    | "fields"
    | "errorRingClasses"
    | "onPickupTimeChange"
    | "onAddressUpdate"
    | "onFlightValidated"
  >
>;

function TimeOrFlightField({
  bookingType,
  dateRange,
  fallbackDate,
  fields,
  errorRingClasses,
  onPickupTimeChange,
  onAddressUpdate,
  onFlightValidated,
}: TimeOrFlightFieldProps) {
  // Airport pickup: show flight number field
  if (bookingType === AIRPORT_PICKUP_BOOKING_TYPE && fields.flightNumber) {
    const inputPropsFromConform = getInputProps(fields.flightNumber, {
      type: "text",
      ariaAttributes: true,
    });
    return (
      <div className="space-y-1">
        <Label htmlFor={fields.flightNumber.id} className="font-semibold">
          Flight Number
        </Label>
        <AutocompleteFlight
          id={fields.flightNumber.id}
          onSelect={(flightNumber) => {
            onAddressUpdate(fields.flightNumber?.name ?? "flightNumber", flightNumber);
          }}
          inputProps={inputPropsFromConform}
          initialValue={fields.flightNumber.value}
          className={fields.flightNumber.errors ? errorRingClasses : ""}
          nigeriaOnly={true}
          pickupDate={(dateRange.from || fallbackDate).toISOString().split("T")[0]}
          onFlightValidated={(flight) => {
            if (onFlightValidated) {
              onFlightValidated(flight);
            }
          }}
        />
        <FieldError errors={fields.flightNumber.errors} />
      </div>
    );
  }

  // Night booking: hidden input with fixed time
  if (bookingType === NIGHT_BOOKING_TYPE) {
    return <input type="hidden" name="pickupTime" value="11:00 PM" />;
  }

  // Other booking types: show pickup time selector
  return (
    <div className="space-y-1">
      <Label htmlFor={fields.pickupTime.id} className="font-semibold">
        Pickup Time
      </Label>
      <BookingTimeSelect
        date={dateRange.from ?? fallbackDate}
        bookingType={bookingType}
        {...getInputProps(fields.pickupTime, { type: "text", ariaAttributes: true })}
        className={fields.pickupTime.errors ? errorRingClasses : ""}
        onValueChange={onPickupTimeChange}
      />
      <FieldError errors={fields.pickupTime.errors} />
    </div>
  );
}

export function BookingFormFields({
  bookingType,
  dateRange,
  fallbackDate,
  fields,
  sameLocationChecked,
  formId,
  errorRingClasses,
  nightBookingHelperText,
  onPickupTimeChange,
  onSameLocationChange,
  onAddressUpdate,
  validatedFlight,
  onFlightValidated,
}: BookingFormFieldsProps) {
  return (
    <>
      <TimeOrFlightField
        bookingType={bookingType}
        dateRange={dateRange}
        fallbackDate={fallbackDate}
        fields={fields}
        errorRingClasses={errorRingClasses}
        onPickupTimeChange={onPickupTimeChange}
        onAddressUpdate={onAddressUpdate}
        onFlightValidated={onFlightValidated}
      />

      {bookingType === NIGHT_BOOKING_TYPE && nightBookingHelperText && (
        <div
          className="flex-1 bg-slate-100 rounded-md p-2 text-sm text-orange-600 min-w-0"
          role="alert"
        >
          {nightBookingHelperText}
        </div>
      )}

      <div className="space-y-1">
        <Label htmlFor={fields.pickupAddress.id} className="font-semibold">
          Pickup Address
        </Label>
        {bookingType === AIRPORT_PICKUP_BOOKING_TYPE && validatedFlight ? (
          <Input
            {...getInputProps(fields.pickupAddress, {
              type: "text",
              ariaAttributes: true,
            })}
            key={validatedFlight.flightId}
            value={fields.pickupAddress.value || ""}
            readOnly
            className="bg-gray-50 cursor-not-allowed"
          />
        ) : (
          <AutocompleteAddress
            id={fields.pickupAddress.id}
            onSelect={(address) => onAddressUpdate(fields.pickupAddress.name, address)}
            inputProps={getInputProps(fields.pickupAddress, {
              type: "text",
              ariaAttributes: true,
            })}
            initialValue={fields.pickupAddress.value ?? ""}
            className={fields.pickupAddress.errors ? errorRingClasses : ""}
          />
        )}
        <FieldError errors={fields.pickupAddress.errors} />
      </div>

      {/* Hide "same location" checkbox for airport pickups - always different locations */}
      {bookingType !== AIRPORT_PICKUP_BOOKING_TYPE && (
        <div className="space-y-1">
          <input
            type="hidden"
            name={fields.sameLocation.name}
            value={sameLocationChecked ? "true" : "false"}
          />
          <Label className="flex items-center space-x-2 cursor-pointer">
            <Checkbox
              id={`${fields.sameLocation.id}-ctrl`}
              checked={sameLocationChecked}
              onCheckedChange={onSameLocationChange}
              aria-label="Drop-off location same as pickup"
            />
            <span className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Drop-off location same as pickup
            </span>
          </Label>
          <FieldError errors={fields.sameLocation.errors} />
        </div>
      )}

      {/* For airport pickups, always include hidden field with value "false" */}
      {bookingType === AIRPORT_PICKUP_BOOKING_TYPE && (
        <input type="hidden" name={fields.sameLocation.name} value="false" />
      )}

      {!sameLocationChecked && (
        <div className="space-y-1">
          <Label htmlFor={fields.dropOffAddress.id} className="font-semibold">
            Drop-off Address
          </Label>
          <AutocompleteAddress
            id={fields.dropOffAddress.id}
            onSelect={(address) => onAddressUpdate(fields.dropOffAddress.name, address)}
            inputProps={getInputProps(fields.dropOffAddress, {
              type: "text",
              ariaAttributes: true,
            })}
            initialValue={fields.dropOffAddress.value ?? ""}
            className={fields.dropOffAddress.errors ? errorRingClasses : ""}
          />
          <FieldError errors={fields.dropOffAddress.errors} />
        </div>
      )}
    </>
  );
}
