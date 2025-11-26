import { type FieldMetadata, getInputProps } from "@conform-to/react";
import { type DateRange } from "react-day-picker";
import { AutocompleteAddress } from "../AutocompleteAddress";
import { Checkbox } from "../ui/checkbox";
import { Label } from "../ui/label";
import { BookingTimeSelect } from "./BookingTimeSelect";
import {
  BookingType,
  DAY_BOOKING_TYPE,
  NIGHT_BOOKING_TYPE,
  FULL_DAY_BOOKING_TYPE,
} from "../bookingTypes";

interface BookingFormFieldsProps {
  readonly bookingType: BookingType;
  readonly dateRange: DateRange;
  readonly fallbackDate: Date;
  readonly fields: {
    pickupTime: FieldMetadata<string>;
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
}

function FieldError({ errors }: { readonly errors?: readonly string[] }) {
  if (!errors || errors.length === 0) {
    return null;
  }
  return <p className="text-red-500 text-sm mt-1">{errors.join(", ")}</p>;
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
}: BookingFormFieldsProps) {
  return (
    <>
      {bookingType !== NIGHT_BOOKING_TYPE ? (
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
      ) : (
        <input type="hidden" name="pickupTime" value="11:00 PM" />
      )}

      {bookingType === NIGHT_BOOKING_TYPE && nightBookingHelperText && (
        <div
          className="bg-blue-50 border-l-4 border-blue-400 text-blue-800 p-2 text-sm"
          role="alert"
        >
          {nightBookingHelperText}
        </div>
      )}

      <div className="space-y-1">
        <Label htmlFor={fields.pickupAddress.id} className="font-semibold">
          Pickup Address
        </Label>
        <AutocompleteAddress
          id={fields.pickupAddress.id}
          onSelect={(address) => onAddressUpdate(fields.pickupAddress.name, address)}
          inputProps={getInputProps(fields.pickupAddress, {
            type: "text",
            ariaAttributes: true,
          })}
          className={fields.pickupAddress.errors ? errorRingClasses : ""}
        />
        <FieldError errors={fields.pickupAddress.errors} />
      </div>

      <div className="space-y-1">
        <input
          type="hidden"
          name={fields.sameLocation.name}
          value={sameLocationChecked ? "true" : "false"}
        />
        <div className="flex items-center space-x-2">
          <Checkbox
            id={`${fields.sameLocation.id}-ctrl`}
            checked={sameLocationChecked}
            onCheckedChange={onSameLocationChange}
            aria-label="Drop-off location same as pickup"
          />
          <Label htmlFor={`${fields.sameLocation.id}-ctrl`} className="cursor-pointer">
            Drop-off location same as pickup
          </Label>
        </div>
        <FieldError errors={fields.sameLocation.errors} />
      </div>

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
            className={fields.dropOffAddress.errors ? errorRingClasses : ""}
          />
          <FieldError errors={fields.dropOffAddress.errors} />
        </div>
      )}
    </>
  );
}
