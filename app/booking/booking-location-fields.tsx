import { AddressAutocomplete } from "~/booking/address-autocomplete";
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
  readonly onPickupAddressSelect: (address: string) => void;
  readonly onPickupAddressInput: (value: string) => void;
  readonly onDropOffAddressSelect: (address: string) => void;
  readonly onDropOffAddressInput: (value: string) => void;
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
  onPickupAddressSelect,
  onPickupAddressInput,
  onDropOffAddressSelect,
  onDropOffAddressInput,
  onSameLocationChange,
}: BookingLocationFieldsProps) {
  return (
    <>
      {nightHelper ? (
        <output className="block rounded-md bg-slate-100 p-2 text-sm text-orange-600">
          {nightHelper}
        </output>
      ) : null}

      <div className="space-y-1">
        <Label htmlFor={pickupAddressId} className="block font-semibold leading-5">
          Pickup Address
        </Label>
        <AddressAutocomplete
          id={pickupAddressId}
          value={pickupAddress}
          onSelect={onPickupAddressSelect}
          onValueChange={onPickupAddressInput}
          readOnly={pickupIsReadOnly}
        />
      </div>

      {isAirportPickup ? null : (
        <div className="space-y-1">
          <Label htmlFor={sameLocationId} className="flex cursor-pointer items-center space-x-2">
            <Checkbox
              id={sameLocationId}
              checked={sameLocation}
              onCheckedChange={(checked) => onSameLocationChange(checked === true)}
            />
            <span className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Drop-off location same as pickup
            </span>
          </Label>
        </div>
      )}

      {showDropOff ? (
        <div className="space-y-1">
          <Label htmlFor={dropOffAddressId} className="block font-semibold leading-5">
            Drop-off Address
          </Label>
          <AddressAutocomplete
            id={dropOffAddressId}
            value={dropOffAddress}
            onSelect={onDropOffAddressSelect}
            onValueChange={onDropOffAddressInput}
          />
        </div>
      ) : null}
    </>
  );
}
