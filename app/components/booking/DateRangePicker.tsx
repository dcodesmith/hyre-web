import { addDays, format, startOfDay, startOfToday } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { DateRange } from "react-day-picker";
import { Button } from "~/components/ui/button";
import { Calendar } from "~/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { cn } from "~/lib/utils";
import { LAGOS_TIMEZONE, getLagosHour } from "~/utils/timezone";

interface DateRangePickerProps {
  readonly date: DateRange;
  readonly onDateChange: (dateRange: DateRange) => void;
  readonly className?: string;
  readonly isNightBooking?: boolean;
  readonly isFullDayBooking?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  readonly singleDateMode?: boolean; // New prop to enable single date selection
  readonly disableToday?: boolean; // Disable today's date selection
}

export function DateRangePicker({
  date,
  onDateChange,
  className,
  isNightBooking,
  isFullDayBooking,
  onOpenChange,
  singleDateMode = false,
  disableToday = false,
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

  // Get current hour in Lagos timezone for consistent date picker behavior
  const currentLagosHour = getLagosHour();

  // Determine if the Lagos cutoff means "tomorrow" based on Lagos business rules
  const lagosCutoffIsTomorrow = isNightBooking
    ? currentLagosHour >= 23
    : isFullDayBooking
      ? false // FULL_DAY bookings can always select today
      : currentLagosHour >= 12;

  // Convert Lagos day decision to a local Date boundary for the Calendar
  // Get start of day in Lagos timezone
  const lagosNow = toZonedTime(new Date(), LAGOS_TIMEZONE);
  const lagosStartOfDay = startOfDay(lagosNow);
  const lagosBoundary = lagosCutoffIsTomorrow ? addDays(lagosStartOfDay, 1) : lagosStartOfDay;

  // Convert that Lagos instant to user's local timezone for the Calendar component
  const boundaryLocal = fromZonedTime(lagosBoundary, LAGOS_TIMEZONE);

  // If disableToday is true, start from tomorrow; otherwise use the boundary logic
  const disabledDays = {
    before: disableToday ? addDays(startOfToday(), 1) : boundaryLocal,
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

    // For night bookings, enforce that start and end dates must be different
    if (isNightBooking && normalizedRange.from && normalizedRange.to) {
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

  return (
    <div className={cn("grid gap-2 w-full", className)}>
      <Popover open={isOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            onClick={() => setIsOpen(!isOpen)}
            className={cn(
              "justify-start text-left font-normal px-3",
              !normalizedDate.from && "text-muted-foreground",
            )}
          >
            {/* <CalendarIcon className="mr-2 h-5 w-5" /> */}
            {normalizedDate?.from ? (
              singleDateMode ||
              !normalizedDate.to ||
              normalizedDate.from.getTime() === normalizedDate.to.getTime() ? (
                format(normalizedDate.from, "LLL dd, y")
              ) : (
                <>
                  {format(normalizedDate.from, "LLL dd, y")} -{" "}
                  {format(normalizedDate.to, "LLL dd, y")}
                </>
              )
            ) : (
              <span className="text-black">Pick a date{singleDateMode ? "" : " range"}</span>
            )}
            {isOpen ? (
              <ChevronsDownUp className="h-4 w-4 ml-auto" />
            ) : (
              <ChevronsUpDown className="h-4 w-4 ml-auto" />
            )}
          </Button>
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
                {normalizedDate?.from ? (
                  singleDateMode ||
                  !normalizedDate.to ||
                  normalizedDate.from.getTime() === normalizedDate.to.getTime() ? (
                    format(normalizedDate.from, "LLL dd, y")
                  ) : (
                    <>
                      {format(normalizedDate.from, "LLL dd, y")} -{" "}
                      {format(normalizedDate.to, "LLL dd, y")}
                    </>
                  )
                ) : (
                  `No date${singleDateMode ? "" : "s"} selected`
                )}
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
                {/* <Button
                  className="flex-1"
                  onClick={() => {
                    const closeEvent = new KeyboardEvent("keydown", {
                      key: "Escape",
                      bubbles: true,
                    });
                    document.dispatchEvent(closeEvent);
                  }}
                >
                  Confirm
                </Button> */}
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
