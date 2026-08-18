import type { ComponentProps } from "react";

import {
  bookingFieldLabelClass,
  bookingFieldStackClass,
} from "~/components/booking/booking-type-input";
import { cn } from "~/lib/utils";

interface LabeledDateTriggerProps {
  readonly triggerId: string;
  readonly labelTextId: string;
  readonly valueTextId: string;
  readonly hasDate: boolean;
  readonly label: string;
  readonly formattedDate: string | null;
  readonly placeholder: string;
}

export function LabeledDateTrigger({
  triggerId,
  labelTextId,
  valueTextId,
  hasDate,
  label,
  formattedDate,
  placeholder,
  className,
  ref,
  ...buttonProps
}: LabeledDateTriggerProps & ComponentProps<"button">) {
  const isDisabled = buttonProps.disabled === true;

  return (
    <button
      ref={ref}
      {...buttonProps}
      id={triggerId}
      type="button"
      className={cn(
        bookingFieldStackClass,
        "cursor-pointer appearance-none border-0 bg-transparent font-normal outline-none",
        !hasDate && "text-muted-foreground",
        isDisabled && "cursor-not-allowed opacity-50",
        className,
      )}
      aria-labelledby={`${labelTextId} ${valueTextId}`}
    >
      <span id={labelTextId} className={bookingFieldLabelClass}>
        {label}
      </span>
      <div
        id={valueTextId}
        className={cn("text-sm leading-tight", hasDate ? "text-gray-900" : "text-gray-500")}
      >
        {formattedDate ?? placeholder}
      </div>
    </button>
  );
}
