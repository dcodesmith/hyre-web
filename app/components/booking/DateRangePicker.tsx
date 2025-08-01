import { CalendarIcon } from "@heroicons/react/24/outline";
import { addDays, format, startOfToday, startOfTomorrow, parseISO, startOfDay } from "date-fns";
import { ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { DateRange } from "react-day-picker";
import { Button } from "~/components/ui/button";
import { Calendar } from "~/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { cn } from "~/lib/utils";

interface DateRangePickerProps {
  date: DateRange;
  onDateChange: (dateRange: DateRange) => void;
  className?: string;
  isNightBooking?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function DateRangePicker({
  date,
  onDateChange,
  className,
  isNightBooking,
  onOpenChange,
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

  const disabledDays = {
    before: isNightBooking
      ? new Date().getHours() >= 23
        ? startOfTomorrow()
        : startOfToday()
      : new Date().getHours() >= 12
        ? startOfTomorrow()
        : startOfToday(),
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

    // Close the calendar if both dates are selected
    if (normalizedRange.from && normalizedRange.to) {
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
              normalizedDate.to ? (
                <>
                  {format(normalizedDate.from, "LLL dd, y")} -{" "}
                  {format(normalizedDate.to, "LLL dd, y")}
                </>
              ) : (
                format(normalizedDate.from, "LLL dd, y")
              )
            ) : (
              <span className="text-black">Pick a date</span>
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
            <Calendar
              initialFocus
              mode="range"
              selected={normalizedDate}
              defaultMonth={addDays(new Date(), 1)}
              onSelect={handleDateChange}
              numberOfMonths={2}
              disabled={disabledDays}
            />
            <div className="flex justify-between items-center flex-col sm:flex-row gap-2 p-2 w-full border-t">
              <div className="text-sm h-10 items-center flex font-semibold">
                {normalizedDate?.from ? (
                  normalizedDate.to ? (
                    <>
                      {format(normalizedDate.from, "LLL dd, y")} -{" "}
                      {format(normalizedDate.to, "LLL dd, y")}
                    </>
                  ) : (
                    format(normalizedDate.from, "LLL dd, y")
                  )
                ) : (
                  "No dates selected"
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
