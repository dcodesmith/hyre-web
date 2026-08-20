import { ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import type { ComponentProps } from "react";

import { bookingFieldLabelClass, bookingFieldStackClass } from "~/booking/booking-type-input";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

interface LabeledDateTriggerProps {
  readonly triggerId: string;
  readonly labelTextId: string;
  readonly valueTextId: string;
  readonly hasDate: boolean;
  readonly label: string;
  readonly formattedDate: string | null;
  readonly placeholder: string;
  readonly isCompact?: boolean;
}

export function LabeledDateTrigger({
  triggerId,
  labelTextId,
  valueTextId,
  hasDate,
  label,
  formattedDate,
  placeholder,
  isCompact = false,
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
        isCompact ? "h-auto gap-0.5 px-0" : "h-10 px-0",
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

interface OutlineDateTriggerProps {
  readonly triggerId: string;
  readonly hasDate: boolean;
  readonly formattedDate: string | null;
  readonly placeholder: string;
  readonly isOpen: boolean;
}

export function OutlineDateTrigger({
  triggerId,
  hasDate,
  formattedDate,
  placeholder,
  isOpen,
  className,
  ref,
  ...buttonProps
}: OutlineDateTriggerProps & ComponentProps<typeof Button>) {
  const isDisabled = buttonProps.disabled === true;

  return (
    <Button
      {...buttonProps}
      ref={ref}
      id={triggerId}
      type="button"
      variant="outline"
      className={cn(
        "h-10 w-full justify-start px-3 text-left text-sm font-normal",
        !hasDate && "text-muted-foreground",
        isDisabled && "cursor-not-allowed opacity-50",
        className,
      )}
      aria-label={hasDate ? `Selected date: ${formattedDate}` : placeholder}
    >
      {formattedDate ?? <span>{placeholder}</span>}
      {isOpen ? (
        <ChevronsDownUp className="ml-auto h-4 w-4" />
      ) : (
        <ChevronsUpDown className="ml-auto h-4 w-4" />
      )}
    </Button>
  );
}
