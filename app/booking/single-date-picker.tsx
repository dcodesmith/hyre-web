import { lazy, Suspense, useId, useState } from "react";
import { LabeledDateTrigger } from "~/booking/date-picker-triggers";
import { getDisabledBookableDays, getEarliestBookableDate } from "~/booking/dates";
import type { BookingType } from "~/booking/types";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { cn } from "~/lib/utils";
import { formatPickerDate, SERVICE_TIMEZONE } from "~/time/timezone";

const Calendar = lazy(async () => {
  const { Calendar: CalendarComponent } = await import("~/components/ui/calendar");
  return { default: CalendarComponent };
});

const calendarFallback = <div className="h-75 w-70" aria-hidden="true" />;

interface SingleDatePickerProps {
  readonly bookingType: BookingType;
  readonly date: Date | undefined;
  readonly onDateChange: (date: Date | undefined) => void;
  readonly className?: string;
  readonly minDate?: Date;
  readonly disabled?: boolean;
  readonly label?: string;
  readonly placeholder?: string;
  readonly isCompact?: boolean;
}

export function SingleDatePicker({
  bookingType,
  date,
  onDateChange,
  className,
  minDate,
  disabled = false,
  label = "Date",
  placeholder = "Select date…",
  isCompact = false,
}: SingleDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootId = useId();
  const triggerId = `${rootId}-trigger`;
  const labelTextId = `${rootId}-label-text`;
  const valueTextId = `${rootId}-value-text`;

  const normalizedDate = date ? new Date(date) : undefined;
  const earliestDate = getEarliestBookableDate({
    bookingType,
    minDate,
  });
  const disabledDays = getDisabledBookableDays(earliestDate);

  const handleDateChange = (selectedDate: Date | undefined) => {
    onDateChange(selectedDate);
    if (selectedDate) {
      setIsOpen(false);
    }
  };

  const hasDate = Boolean(normalizedDate);
  const formattedDate = normalizedDate ? formatPickerDate(normalizedDate) : null;

  return (
    <div className={cn("w-full", className)}>
      <Popover open={isOpen && !disabled} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <LabeledDateTrigger
            triggerId={triggerId}
            labelTextId={labelTextId}
            valueTextId={valueTextId}
            disabled={disabled}
            hasDate={hasDate}
            label={label}
            formattedDate={formattedDate}
            placeholder={placeholder}
            isCompact={isCompact}
          />
        </PopoverTrigger>
        <PopoverContent
          className="w-auto gap-0 rounded border border-neutral-200 bg-white p-0 text-neutral-950 shadow-md ring-0"
          align="start"
        >
          <div className="flex w-auto flex-col">
            {isOpen ? (
              <Suspense fallback={calendarFallback}>
                <Calendar
                  autoFocus
                  mode="single"
                  timeZone={SERVICE_TIMEZONE}
                  selected={normalizedDate}
                  defaultMonth={normalizedDate ?? earliestDate}
                  onSelect={handleDateChange}
                  numberOfMonths={1}
                  disabled={disabledDays}
                />
              </Suspense>
            ) : null}
            <div className="flex w-full flex-col items-center justify-between gap-2 border-t p-2 sm:flex-row">
              <div className="flex h-10 items-center text-sm font-semibold">
                {formattedDate ?? "No date selected"}
              </div>
              <div className="flex w-full gap-2 sm:w-auto">
                <button
                  type="button"
                  className="inline-flex h-10 flex-1 items-center justify-center rounded-md bg-muted px-4 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  onClick={() => {
                    setIsOpen(false);
                    onDateChange(undefined);
                  }}
                >
                  Clear Selection
                </button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
