import type { TripDurationResponse } from "~/api/flights/schema";
import { AddressAutocomplete } from "~/booking/address-autocomplete";
import { formatTripDuration } from "~/booking/airport-pickup";
import { Checkbox } from "~/components/ui/checkbox";
import { Label } from "~/components/ui/label";

interface BookingLocationFieldsProps {
  readonly pickupAddressId: string;
  readonly dropOffAddressId: string;
  readonly sameLocationId: string;
  readonly pickupAddress: string;
  readonly dropOffAddress: string;
  readonly sameLocation: boolean;
  readonly isAirportPickup: boolean;
  readonly pickupIsReadOnly: boolean;
  readonly showDropOff: boolean;
  readonly nightHelper: string | null;
  readonly tripDuration: TripDurationResponse | null;
  readonly onPickupAddressSelect: (address: string) => void;
  readonly onDropOffAddressSelect: (address: string) => void;
  readonly onSameLocationChange: (checked: boolean) => void;
}

export function BookingLocationFields({
  pickupAddressId,
  dropOffAddressId,
  sameLocationId,
  pickupAddress,
  dropOffAddress,
  sameLocation,
  isAirportPickup,
  pickupIsReadOnly,
  showDropOff,
  nightHelper,
  tripDuration,
  onPickupAddressSelect,
  onDropOffAddressSelect,
  onSameLocationChange,
}: BookingLocationFieldsProps) {
  return (
    <>
      {nightHelper ? (
        <output className="block rounded-md bg-slate-100 p-2 text-sm text-orange-600">
          {nightHelper}
        </output>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor={pickupAddressId} className="block font-semibold">
          Pickup Address
        </Label>
        <AddressAutocomplete
          id={pickupAddressId}
          value={pickupAddress}
          onSelect={onPickupAddressSelect}
          readOnly={pickupIsReadOnly}
        />
      </div>

      {isAirportPickup ? null : (
        <Label htmlFor={sameLocationId} className="flex cursor-pointer items-center gap-2">
          <Checkbox
            id={sameLocationId}
            checked={sameLocation}
            onCheckedChange={(checked) => onSameLocationChange(checked === true)}
          />
          <span className="text-sm font-medium">Drop-off location same as pickup</span>
        </Label>
      )}

      {showDropOff ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor={dropOffAddressId} className="block font-semibold">
            Drop-off Address
          </Label>
          <AddressAutocomplete
            id={dropOffAddressId}
            value={dropOffAddress}
            onSelect={onDropOffAddressSelect}
          />
          {tripDuration ? (
            <p className="text-xs text-gray-600" aria-live="polite">
              {formatTripDuration(tripDuration)}
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
