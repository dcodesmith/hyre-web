import { useId, useState } from "react";
import { getPickupTimes, normalizePickupTime } from "~/booking/pickup";
import type { BookingType } from "~/booking/types";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { cn } from "~/lib/utils";

interface BookingTimeSelectProps {
  readonly date: Date;
  readonly defaultValue?: string;
  readonly value?: string;
  readonly className?: string;
  readonly bookingType?: BookingType;
  readonly onValueChange?: (value: string) => void;
  readonly id?: string;
  readonly name?: string;
  readonly "aria-invalid"?: boolean;
  readonly "aria-describedby"?: string;
  readonly required?: boolean;
  readonly containerClassName?: string;
  readonly labelClassName?: string;
  readonly showLabel?: boolean;
  readonly placeholder?: string;
}

export function BookingTimeSelect({
  date,
  defaultValue,
  value,
  className,
  bookingType = "DAY",
  onValueChange,
  id,
  name,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  required,
  containerClassName,
  labelClassName = "text-xs font-semibold leading-tight text-gray-700",
  showLabel = false,
  placeholder = "Select pickup time",
}: BookingTimeSelectProps) {
  const autoTriggerId = useId();
  const triggerId = id ?? autoTriggerId;
  const normalizedValue = value ? normalizePickupTime(value) : undefined;
  const normalizedDefaultValue = defaultValue ? normalizePickupTime(defaultValue) : undefined;
  const isControlled = normalizedValue !== undefined;
  const [uncontrolledHiddenValue, setUncontrolledHiddenValue] = useState(
    normalizedDefaultValue ?? "",
  );

  const handleValueChange = (next: string) => {
    if (!isControlled) {
      setUncontrolledHiddenValue(next);
    }
    onValueChange?.(next);
  };

  const hiddenInputValue = normalizedValue ?? uncontrolledHiddenValue;
  const hiddenInput = name ? (
    <input type="hidden" name={name} value={hiddenInputValue} suppressHydrationWarning />
  ) : null;

  const select = (
    <Select
      value={normalizedValue}
      defaultValue={normalizedValue === undefined ? normalizedDefaultValue : undefined}
      onValueChange={handleValueChange}
    >
      <SelectTrigger
        id={triggerId}
        aria-label={showLabel ? undefined : "Select pickup time"}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        aria-required={required === true ? true : undefined}
        className={cn(
          containerClassName
            ? "h-auto w-full cursor-pointer items-center justify-start gap-0 rounded-none border-0 bg-transparent p-0 text-left text-sm leading-tight font-normal shadow-none hover:bg-transparent focus:ring-0 focus-visible:border-transparent focus-visible:ring-0 focus-visible:ring-offset-0 data-[size=default]:h-auto dark:bg-transparent dark:hover:bg-transparent [&_svg]:hidden *:data-[slot=select-value]:block *:data-[slot=select-value]:h-auto *:data-[slot=select-value]:text-gray-900"
            : "h-10 w-full rounded data-[size=default]:h-10 data-[size=default]:rounded",
          className,
        )}
      >
        <SelectValue
          placeholder={
            containerClassName ? <span className="text-gray-500">{placeholder}</span> : placeholder
          }
        />
      </SelectTrigger>
      <SelectContent position={containerClassName ? "popper" : "item-aligned"} align="start">
        <SelectGroup>
          {getPickupTimes(date, bookingType).map(({ label, value: itemValue }) => (
            <SelectItem key={itemValue} value={itemValue}>
              {label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );

  if (!containerClassName) {
    return (
      <>
        {hiddenInput}
        {select}
      </>
    );
  }

  return (
    <>
      {hiddenInput}
      <div className={cn(containerClassName, "[&_select]:hidden")}>
        {showLabel ? (
          <label htmlFor={triggerId} className={cn(labelClassName, "cursor-pointer")}>
            Pickup Time
          </label>
        ) : null}
        {select}
      </div>
    </>
  );
}
