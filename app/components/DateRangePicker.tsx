import { CalendarIcon } from "@heroicons/react/24/outline";
import { addDays, format, startOfToday, startOfTomorrow, parseISO } from "date-fns";
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
}

export function DateRangePicker({
  date,
  onDateChange,
  className,
  isNightBooking,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);

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

    onDateChange(normalizedRange);
  };

  return (
    <div className={cn("grid gap-2 w-full", className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
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
              <span>Pick a date</span>
            )}
            {isOpen ? (
              <ChevronsDownUp className="h-4 w-4 ml-auto" />
            ) : (
              <ChevronsUpDown className="h-4 w-4 ml-auto" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            // defaultMonth={date?.from}
            selected={normalizedDate}
            defaultMonth={addDays(new Date(), 1)}
            onSelect={handleDateChange}
            numberOfMonths={2}
            // footer={
            //   <div className="flex gap-2 p-2 w-full">
            //     <Button
            //       variant="ghost"
            //       className="text-muted-foreground flex-1 bg-muted"
            //       onClick={() =>
            //         onDateChange({ from: undefined, to: undefined })
            //       }
            //     >
            //       Clear Selection
            //     </Button>
            //     {/* <Button
            //       className="flex-1"
            //       onClick={() => {
            //         // if (date.from && date.to) {
            //         // Only close if both dates selected
            //         const closeEvent = new KeyboardEvent("keydown", {
            //           key: "Escape",
            //           bubbles: true,
            //         });
            //         document.dispatchEvent(closeEvent);
            //         // }
            //       }}
            //     >
            //       Confirm
            //     </Button> */}
            //   </div>
            // }
            disabled={disabledDays}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
