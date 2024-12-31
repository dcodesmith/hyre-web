import { CalendarIcon } from "@heroicons/react/24/outline";
import { addDays, format, startOfToday, startOfTomorrow } from "date-fns";
import { DateRange } from "react-day-picker";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Calendar } from "~/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";

interface DateRangePickerProps {
  date: DateRange;
  onDateChange: (dateRange: DateRange) => void;
  className?: string;
}

export function DateRangePicker({ date, onDateChange, className }: DateRangePickerProps) {
  const disabledDays = {
    before: new Date().getHours() >= 12 ? startOfTomorrow() : startOfToday(),
  };

  return (
    <div className={cn("grid gap-2 w-full", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn("justify-start text-left font-normal", !date && "text-muted-foreground")}
          >
            <CalendarIcon className="mr-2 h-5 w-5" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, "LLL dd, y")} - {format(date.to, "LLL dd, y")}
                </>
              ) : (
                format(date.from, "LLL dd, y")
              )
            ) : (
              <span>Pick a date</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            // defaultMonth={date?.from}
            selected={date}
            defaultMonth={addDays(new Date(), 1)}
            onSelect={(range) => {
              onDateChange(range || { from: undefined, to: undefined });
            }}
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
