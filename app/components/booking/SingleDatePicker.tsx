import { addDays, format, startOfDay, startOfToday } from "date-fns";
import { ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { type ComponentPropsWithoutRef, type ElementRef, forwardRef, useId, useState } from "react";
import { Button } from "~/components/ui/button";
import { Calendar } from "~/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { cn } from "~/lib/utils";
import { getLagosHour } from "~/utils/timezone";

/**
 * Determines if booking cutoff means earliest date is tomorrow based on Lagos time.
 */
function isLagosCutoffTomorrow(
  isAirportPickup: boolean,
  isNightBooking: boolean,
  isFullDayBooking: boolean,
): boolean {
  if (isAirportPickup || isFullDayBooking) return false;

  const currentLagosHour = getLagosHour();
  if (isNightBooking) return currentLagosHour >= 23;
  return currentLagosHour >= 11; // DAY bookings
}

interface SingleDatePickerProps {
  readonly date: Date | undefined;
  readonly onDateChange: (date: Date | undefined) => void;
  readonly className?: string;
  readonly isNightBooking?: boolean;
  readonly isFullDayBooking?: boolean;
  readonly isAirportPickup?: boolean;
  readonly disableToday?: boolean;
  readonly isCompact?: boolean;
  readonly showLabel?: boolean;
  readonly minDate?: Date;
  readonly maxDate?: Date;
  readonly disabled?: boolean;
  readonly label?: string;
  readonly placeholder?: string;
  /** Date to explicitly disable (e.g., "from" date when used in "to" picker) */
  readonly disableDate?: Date;
}

function buildDisabledDayMatchers(
  minDisabledDateNormalized: Date,
  maxDate: Date | undefined,
  disableDate: Date | undefined,
): Array<
  { before: Date; after?: Date } | { after: Date; before?: Date } | { before: Date } | Date
> {
  const disabledMatchers: Array<
    { before: Date; after?: Date } | { after: Date; before?: Date } | { before: Date } | Date
  > = [];

  if (maxDate) {
    disabledMatchers.push({ before: minDisabledDateNormalized, after: maxDate });
  } else {
    disabledMatchers.push({ before: minDisabledDateNormalized });
  }

  if (disableDate) {
    disabledMatchers.push(startOfDay(disableDate));
  }

  return disabledMatchers;
}

interface LabeledDateTriggerProps {
  readonly triggerId: string;
  readonly labelTextId: string;
  readonly valueTextId: string;
  readonly isCompact: boolean;
  readonly hasDate: boolean;
  readonly label: string;
  readonly formattedDate: string | null;
  readonly placeholder: string;
}

const LabeledDateTrigger = forwardRef<
  ElementRef<typeof Button>,
  LabeledDateTriggerProps & ComponentPropsWithoutRef<typeof Button>
>(
  (
    {
      triggerId,
      labelTextId,
      valueTextId,
      isCompact,
      hasDate,
      label,
      formattedDate,
      placeholder,
      className,
      ...buttonProps
    },
    ref,
  ) => {
    const isDisabled = buttonProps.disabled === true;

    return (
      <Button
        ref={ref}
        {...buttonProps}
        id={triggerId}
        type="button"
        variant="ghost"
        className={cn(
          "w-full text-left font-normal hover:bg-transparent flex flex-col items-start justify-center",
          isCompact ? "h-auto gap-0.5 px-0" : "h-10 px-0",
          !hasDate && "text-muted-foreground",
          isDisabled && "opacity-50 cursor-not-allowed",
          className,
        )}
        aria-labelledby={`${labelTextId} ${valueTextId}`}
      >
        <span id={labelTextId} className="text-xs font-semibold text-gray-700 leading-tight">
          {label}
        </span>
        <div
          id={valueTextId}
          className={cn("text-sm leading-tight", hasDate ? "text-gray-900" : "text-gray-500")}
        >
          {formattedDate ?? placeholder}
        </div>
      </Button>
    );
  },
);
LabeledDateTrigger.displayName = "LabeledDateTrigger";

interface OutlineDateTriggerProps {
  readonly triggerId: string;
  readonly hasDate: boolean;
  readonly formattedDate: string | null;
  readonly placeholder: string;
  readonly isOpen: boolean;
}

const OutlineDateTrigger = forwardRef<
  ElementRef<typeof Button>,
  OutlineDateTriggerProps & ComponentPropsWithoutRef<typeof Button>
>(({ triggerId, hasDate, formattedDate, placeholder, isOpen, className, ...buttonProps }, ref) => {
  const isDisabled = buttonProps.disabled === true;

  return (
    <Button
      ref={ref}
      {...buttonProps}
      id={triggerId}
      type="button"
      variant="outline"
      className={cn(
        "w-full justify-start text-left font-normal px-3",
        !hasDate && "text-muted-foreground",
        isDisabled && "opacity-50 cursor-not-allowed",
        className,
      )}
      aria-label={hasDate ? `Selected date: ${formattedDate}` : placeholder}
    >
      {formattedDate ?? <span>{placeholder}</span>}
      {isOpen ? (
        <ChevronsDownUp className="h-4 w-4 ml-auto" />
      ) : (
        <ChevronsUpDown className="h-4 w-4 ml-auto" />
      )}
    </Button>
  );
});
OutlineDateTrigger.displayName = "OutlineDateTrigger";

export function SingleDatePicker({
  date,
  onDateChange,
  className,
  isNightBooking,
  isFullDayBooking,
  isAirportPickup,
  disableToday = false,
  isCompact = false,
  showLabel = true,
  minDate,
  maxDate,
  disabled = false,
  label: customLabel,
  placeholder: customPlaceholder,
  disableDate,
}: SingleDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootId = useId();
  const triggerId = `${rootId}-trigger`;
  const labelTextId = `${rootId}-label-text`;
  const valueTextId = `${rootId}-value-text`;

  // Ensure we're working with Date object
  const normalizedDate = date ? new Date(date) : undefined;

  // Determine earliest selectable date based on Lagos business rules
  const today = startOfToday();
  const lagosCutoffIsTomorrow = isLagosCutoffTomorrow(
    isAirportPickup ?? false,
    isNightBooking ?? false,
    isFullDayBooking ?? false,
  );
  const earliestDate = lagosCutoffIsTomorrow ? addDays(today, 1) : today;

  // Build disabled days configuration
  // If disableToday is true, start from tomorrow; otherwise use the cutoff logic
  const businessRuleMinDate = disableToday ? addDays(today, 1) : earliestDate;

  // Use the later of business rule min date or provided minDate
  const minDisabledDate = minDate
    ? new Date(Math.max(minDate.getTime(), businessRuleMinDate.getTime()))
    : businessRuleMinDate;

  // Build disabled matcher - only include properties that are defined
  // For react-day-picker, { before: Date } disables all dates BEFORE the specified date
  // So if minDate is Jan 2, we want { before: Jan 2 } to disable Jan 1 and earlier
  // Normalize to start of day to ensure proper date comparison (avoid time component issues)
  const minDisabledDateNormalized = startOfDay(minDisabledDate);

  const disabledMatchers = buildDisabledDayMatchers(
    minDisabledDateNormalized,
    maxDate,
    disableDate,
  );
  const disabledDays = disabledMatchers.length === 1 ? disabledMatchers[0] : disabledMatchers;

  const handleDateChange = (selectedDate: Date | undefined) => {
    onDateChange(selectedDate);
    // Close the calendar when a date is selected
    if (selectedDate) {
      setIsOpen(false);
    }
  };

  // Display logic
  const hasDate = !!normalizedDate;
  const displayFormat = showLabel ? "MMM dd" : "LLL dd, y";
  const formattedDate = normalizedDate ? format(normalizedDate, displayFormat) : null;
  const label = customLabel ?? (showLabel ? "Date" : "");
  const placeholder = customPlaceholder ?? (showLabel ? "Select date" : "Pick a date");

  return (
    <div className={cn("w-full", className)}>
      <Popover open={isOpen && !disabled} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          {showLabel ? (
            <LabeledDateTrigger
              triggerId={triggerId}
              labelTextId={labelTextId}
              valueTextId={valueTextId}
              isCompact={isCompact}
              disabled={disabled}
              hasDate={hasDate}
              label={label}
              formattedDate={formattedDate}
              placeholder={placeholder}
            />
          ) : (
            <OutlineDateTrigger
              triggerId={triggerId}
              disabled={disabled}
              hasDate={hasDate}
              formattedDate={formattedDate}
              placeholder={placeholder}
              isOpen={isOpen}
            />
          )}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex flex-col w-auto">
            <Calendar
              initialFocus
              mode="single"
              selected={normalizedDate}
              defaultMonth={normalizedDate ?? minDisabledDate}
              onSelect={handleDateChange}
              numberOfMonths={1}
              disabled={disabledDays}
            />
            <div className="flex justify-between items-center flex-col sm:flex-row gap-2 p-2 w-full border-t">
              <div className="text-sm h-10 items-center flex font-semibold">
                {formattedDate ?? "No date selected"}
              </div>

              <div className="flex gap-2 sm:w-auto w-full">
                <Button
                  type="button"
                  variant="ghost"
                  className="text-muted-foreground flex-1 bg-muted"
                  onClick={() => {
                    setIsOpen(false);
                    onDateChange(undefined);
                  }}
                >
                  Clear Selection
                </Button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
