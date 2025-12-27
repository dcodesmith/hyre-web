import { addDays, format, startOfDay, startOfToday } from "date-fns";
import { ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { DateRange } from "react-day-picker";
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

/**
 * Formats date range for display.
 */
function formatDateDisplay(
  from: Date | undefined,
  to: Date | undefined,
  singleDateMode: boolean,
  formatStr: string,
): string | null {
  if (!from) return null;

  const isSingleDate = singleDateMode || !to || from.getTime() === to.getTime();
  if (isSingleDate) return format(from, formatStr);

  return `${format(from, formatStr)} - ${format(to, formatStr)}`;
}

interface DateRangePickerProps {
  readonly date: DateRange;
  readonly onDateChange: (dateRange: DateRange) => void;
  readonly className?: string;
  readonly isNightBooking?: boolean;
  readonly isFullDayBooking?: boolean;
  readonly isAirportPickup?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  readonly singleDateMode?: boolean;
  readonly disableToday?: boolean;
  readonly isCompact?: boolean;
  readonly showLabel?: boolean;
}

export function DateRangePicker({
  date,
  onDateChange,
  className,
  isNightBooking,
  isFullDayBooking,
  isAirportPickup,
  onOpenChange,
  singleDateMode = false,
  disableToday = false,
  isCompact = false,
  showLabel = true,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    onOpenChange?.(open);
  };

  // Ensure we're working with Date objects
  const normalizedDate = {
    from: date.from ? new Date(date.from) : undefined,
    to: date.to ? new Date(date.to) : undefined,
  };

  // Determine earliest selectable date based on Lagos business rules
  const today = startOfToday();
  const lagosCutoffIsTomorrow = isLagosCutoffTomorrow(
    isAirportPickup ?? false,
    isNightBooking ?? false,
    isFullDayBooking ?? false,
  );
  const earliestDate = lagosCutoffIsTomorrow ? addDays(today, 1) : today;

  // If disableToday is true, start from tomorrow; otherwise use the cutoff logic
  const disabledDays = {
    before: disableToday ? addDays(today, 1) : earliestDate,
  };

  const handleDateChange = (range: DateRange | undefined) => {
    if (!range) {
      onDateChange({ from: undefined, to: undefined });
      return;
    }

    // Ensure we're working with Date objects
    const normalizedRange = {
      from: range.from ? new Date(range.from) : undefined,
      to: range.to ? new Date(range.to) : undefined,
    };

    // For single date mode, set both from and to to the same date
    if (singleDateMode && normalizedRange.from) {
      const singleDate = normalizedRange.from;
      onDateChange({ from: singleDate, to: singleDate });
      handleOpenChange(false);
      return;
    }

    // For night and full day bookings, enforce that start and end dates must be different
    if ((isNightBooking || isFullDayBooking) && normalizedRange.from && normalizedRange.to) {
      const startDate = startOfDay(normalizedRange.from);
      const endDate = startOfDay(normalizedRange.to);

      if (startDate.getTime() === endDate.getTime()) {
        // If same day selected, don't allow the selection
        return;
      }
    }

    onDateChange(normalizedRange);

    // Close the calendar if both dates are selected (or single date in single mode)
    if (normalizedRange.from && (singleDateMode || normalizedRange.to)) {
      handleOpenChange(false);
    }
  };

  // Shared display logic for both button variants
  const hasDate = !!normalizedDate.from;
  const displayFormat = showLabel ? "MMM dd" : "LLL dd, y";
  const formattedDate = formatDateDisplay(
    normalizedDate.from,
    normalizedDate.to,
    singleDateMode,
    displayFormat,
  );
  const label = singleDateMode ? "Date" : "Dates";

  const getPlaceholder = () => {
    if (singleDateMode) return showLabel ? "Select date" : "Pick a date";
    return showLabel ? "Select dates" : "Pick a date range";
  };
  const placeholder = getPlaceholder();

  return (
    <div className={cn("w-full", className)}>
      <Popover open={isOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          {showLabel ? (
            <Button
              id="date"
              variant="ghost"
              className={cn(
                "w-full text-left font-normal hover:bg-transparent flex flex-col items-start justify-center",
                isCompact ? "h-auto gap-0.5 px-0" : "h-10 px-0",
                !hasDate && "text-muted-foreground",
              )}
              aria-label={hasDate ? `${label}: ${formattedDate}` : `${label}: ${placeholder}`}
            >
              <span className="text-xs font-semibold text-gray-700 leading-tight">{label}</span>
              <div
                className={cn("text-sm leading-tight", hasDate ? "text-gray-900" : "text-gray-400")}
              >
                {formattedDate ?? placeholder}
              </div>
            </Button>
          ) : (
            <Button
              id="date"
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal px-3",
                !hasDate && "text-muted-foreground",
              )}
              aria-label={hasDate ? `Select date: ${formattedDate}` : `Select date: ${placeholder}`}
            >
              {formattedDate ?? <span>{placeholder}</span>}
              {isOpen ? (
                <ChevronsDownUp className="h-4 w-4 ml-auto" />
              ) : (
                <ChevronsUpDown className="h-4 w-4 ml-auto" />
              )}
            </Button>
          )}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex flex-col w-auto">
            {singleDateMode ? (
              <Calendar
                initialFocus
                mode="single"
                selected={normalizedDate.from}
                defaultMonth={addDays(new Date(), 1)}
                onSelect={(date: Date | undefined) =>
                  handleDateChange(date ? { from: date, to: date } : undefined)
                }
                numberOfMonths={1}
                disabled={disabledDays}
              />
            ) : (
              <Calendar
                initialFocus
                mode="range"
                selected={normalizedDate}
                defaultMonth={addDays(new Date(), 1)}
                onSelect={handleDateChange}
                numberOfMonths={2}
                disabled={disabledDays}
              />
            )}
            <div className="flex justify-between items-center flex-col sm:flex-row gap-2 p-2 w-full border-t">
              <div className="text-sm h-10 items-center flex font-semibold">
                {formatDateDisplay(
                  normalizedDate.from,
                  normalizedDate.to,
                  singleDateMode,
                  "LLL dd, y",
                ) ?? `No date${singleDateMode ? "" : "s"} selected`}
              </div>

              <div className="flex gap-2 sm:w-auto w-full">
                <Button
                  variant="ghost"
                  className="text-muted-foreground flex-1 bg-muted"
                  onClick={() => {
                    handleOpenChange(false);
                    onDateChange({ from: undefined, to: undefined });
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
