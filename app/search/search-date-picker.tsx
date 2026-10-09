import { cn } from "cn";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import { forwardRef, useId, useRef, useState } from "react";
import type { DateRange } from "react-day-picker";
import {
  getDisabledBookableDays,
  getEarliestBookableDate,
  getToDateMinDate,
} from "~/booking/dates";
import { type BookingType, FULL_DAY_BOOKING_TYPE, NIGHT_BOOKING_TYPE } from "~/booking/types";
import { Calendar } from "~/components/ui/calendar";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { formatCompactPickerDate, SERVICE_TIMEZONE } from "~/time/timezone";

interface SearchDateTriggerProps extends Omit<React.ComponentPropsWithoutRef<"button">, "value"> {
  readonly label: string;
  readonly value: string | null;
  readonly placeholder: string;
  readonly compact?: boolean;
}

interface SearchDateRangePickerProps {
  readonly bookingType: BookingType;
  readonly fromDate: Date | undefined;
  readonly toDate: Date | undefined;
  readonly onRangeChange: (from: Date | undefined, to: Date | undefined) => void;
  readonly compact?: boolean;
}

interface SearchSingleDatePickerProps {
  readonly bookingType: BookingType;
  readonly date: Date | undefined;
  readonly onDateChange: (date: Date | undefined) => void;
  readonly compact?: boolean;
}

const calendarClassNames = {
  months: "relative flex w-full flex-col gap-4 md:flex-row",
  month:
    "relative flex w-full flex-col gap-1.5 py-3.5 [&_.rdp-button_next]:top-3.5 [&_.rdp-button_next]:right-0 [&_.rdp-button_next]:h-7 [&_.rdp-button_next]:w-9 [&_.rdp-button_previous]:top-3.5 [&_.rdp-button_previous]:left-0 [&_.rdp-button_previous]:h-7 [&_.rdp-button_previous]:w-9",
  month_caption: "relative flex h-9 items-center justify-center px-0",
  month_grid: "w-full border-collapse",
  weekdays: "flex h-6 w-full justify-between",
  weekday:
    "h-6 w-9 flex-none rounded-md py-1 text-xs leading-4 font-normal text-gray-600 select-none",
  week: "mt-1.5 flex w-full justify-between",
  day: "group/day relative size-9 p-0 text-center text-sm select-none",
  range_start: "[&>button]:rounded-md",
  range_middle: "[&>button]:rounded-md [&>button]:bg-gray-100 [&>button]:text-gray-900",
  range_end: "[&>button]:rounded-md",
};

const mobileDateDialogClassName =
  "font-search top-0 left-0 block h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 gap-0 overflow-y-auto rounded-none bg-white p-6 text-gray-950 shadow-none ring-0 data-open:slide-in-from-bottom-full data-closed:slide-out-to-bottom-full sm:max-w-none md:top-1/2 md:left-1/2 md:max-h-[calc(100dvh-2rem)] md:w-auto md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl md:shadow-xl md:ring-1 md:ring-black/5 md:data-open:slide-in-from-bottom-0 md:data-closed:slide-out-to-bottom-0";

function MobileDateDialogClose() {
  return (
    <DialogClose className="absolute top-6 right-0 z-10 inline-flex size-6 items-center justify-center text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden">
      <X className="size-4" aria-hidden="true" />
      <span className="sr-only">Close date picker</span>
    </DialogClose>
  );
}

const SearchDateTrigger = forwardRef<HTMLButtonElement, SearchDateTriggerProps>(
  function SearchDateTrigger(
    { label, value, placeholder, compact = false, className, ...buttonProps },
    ref,
  ) {
    const labelId = useId();
    const valueId = useId();

    return (
      <button
        {...buttonProps}
        ref={ref}
        type="button"
        aria-labelledby={`${labelId} ${valueId}`}
        className={cn(
          "flex w-full min-w-0 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          compact
            ? "h-full flex-col items-start justify-center gap-2 px-3 py-2"
            : "justify-between py-3",
          className,
        )}
      >
        <span id={labelId} className="shrink-0 text-sm leading-none font-semibold text-gray-800">
          {label}
        </span>
        <span className={cn("flex min-w-0 items-center gap-1", compact ? "w-full" : "justify-end")}>
          <span
            id={valueId}
            className={cn(
              "truncate text-sm leading-none font-normal md:text-base",
              compact && "md:text-sm",
              value ? "text-gray-800" : "text-gray-400",
            )}
          >
            {value ?? placeholder}
          </span>
          {compact ? (
            <ChevronDown className="size-4 shrink-0 text-gray-400" aria-hidden="true" />
          ) : (
            <ChevronRight className="size-4 shrink-0 text-gray-400" aria-hidden="true" />
          )}
        </span>
      </button>
    );
  },
);

function DateDisplayInput({
  label,
  value,
  placeholder,
}: {
  readonly label: string;
  readonly value: string;
  readonly placeholder: string;
}) {
  const id = useId();

  return (
    <label htmlFor={id} className="min-w-0 flex-1">
      <span className="mb-1 block text-sm leading-5 font-medium text-gray-900">{label}</span>
      <input
        id={id}
        type="text"
        readOnly
        value={value}
        placeholder={placeholder}
        className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 shadow-[0_1px_1px_rgba(0,0,0,0.05)] outline-none placeholder:text-gray-400 focus-visible:border-gray-900 focus-visible:ring-2 focus-visible:ring-gray-900/20"
      />
    </label>
  );
}

function formatRange(fromDate: Date | undefined, toDate: Date | undefined) {
  if (!fromDate) {
    return null;
  }

  if (!toDate) {
    return formatCompactPickerDate(fromDate);
  }

  const compactFrom = formatCompactPickerDate(fromDate);
  const compactTo = formatCompactPickerDate(toDate);
  const sameMonth = compactFrom.slice(0, 3) === compactTo.slice(0, 3);
  return sameMonth
    ? `${compactFrom} - ${compactTo.replace(/^[A-Za-z]+\s/, "")}`
    : `${compactFrom} - ${compactTo}`;
}

function getFreshRangeStart(
  currentFrom: Date | undefined,
  currentTo: Date | undefined,
  range: DateRange,
) {
  if (!currentFrom || !currentTo) {
    return range.from;
  }
  if (range.from && range.from.getTime() !== currentFrom.getTime()) {
    return range.from;
  }
  if (range.to && range.to.getTime() !== currentTo.getTime()) {
    return range.to;
  }
  return currentFrom;
}

export function SearchDateRangePicker({
  bookingType,
  fromDate,
  toDate,
  onRangeChange,
  compact = false,
}: SearchDateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isSelectingEnd = useRef(false);
  const earliestDate = getEarliestBookableDate({ bookingType });
  const selected = fromDate ? { from: fromDate, to: toDate } : undefined;
  const requiresDifferentEndDate =
    bookingType === NIGHT_BOOKING_TYPE || bookingType === FULL_DAY_BOOKING_TYPE;

  const handleSelect = (range: DateRange | undefined) => {
    if (!range?.from) {
      onRangeChange(undefined, undefined);
      isSelectingEnd.current = false;
      return;
    }

    if (!isSelectingEnd.current) {
      onRangeChange(getFreshRangeStart(fromDate, toDate, range), undefined);
      isSelectingEnd.current = true;
      return;
    }

    onRangeChange(range.from, range.to);
    if (range.to) {
      isSelectingEnd.current = false;
      setIsOpen(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          isSelectingEnd.current = false;
        }
        setIsOpen(nextOpen);
      }}
    >
      <DialogTrigger asChild>
        <SearchDateTrigger
          label="When"
          value={formatRange(fromDate, toDate)}
          placeholder="Add dates"
          compact={compact}
        />
      </DialogTrigger>
      <DialogContent
        aria-describedby={undefined}
        showCloseButton={false}
        overlayClassName="bg-black/30"
        className={cn(mobileDateDialogClassName, "md:h-[435px] md:w-[589px] md:max-w-[589px]")}
      >
        <DialogTitle className="sr-only">Select booking dates</DialogTitle>
        <MobileDateDialogClose />
        <div className="mb-[23px] flex gap-4">
          <DateDisplayInput
            label="Start date"
            value={fromDate ? formatCompactPickerDate(fromDate) : ""}
            placeholder="Select date"
          />
          <DateDisplayInput
            label="End date"
            value={toDate ? formatCompactPickerDate(toDate) : ""}
            placeholder="Select date"
          />
        </div>
        {isOpen ? (
          <Calendar
            autoFocus
            mode="range"
            timeZone={SERVICE_TIMEZONE}
            selected={selected}
            defaultMonth={fromDate ?? earliestDate}
            onSelect={handleSelect}
            numberOfMonths={2}
            min={requiresDifferentEndDate ? 1 : 0}
            excludeDisabled
            disabled={getDisabledBookableDays(earliestDate)}
            className="w-full bg-white p-0"
            classNames={calendarClassNames}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function SearchSingleDatePicker({
  bookingType,
  date,
  onDateChange,
  compact = false,
}: SearchSingleDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const earliestDate = getEarliestBookableDate({ bookingType });

  const handleSelect = (selectedDate: Date | undefined) => {
    onDateChange(selectedDate);
    if (selectedDate) {
      setIsOpen(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <SearchDateTrigger
          label="When"
          value={date ? formatCompactPickerDate(date) : null}
          placeholder="Add date"
          compact={compact}
        />
      </DialogTrigger>
      <DialogContent
        aria-describedby={undefined}
        showCloseButton={false}
        overlayClassName="bg-black/30"
        className={cn(mobileDateDialogClassName, "md:h-auto md:w-[361px] md:max-w-[361px]")}
      >
        <DialogTitle className="sr-only">Select arrival date</DialogTitle>
        <MobileDateDialogClose />
        <div className="mb-[23px] flex">
          <DateDisplayInput
            label="When"
            value={date ? formatCompactPickerDate(date) : ""}
            placeholder="Select date"
          />
        </div>
        {isOpen ? (
          <Calendar
            autoFocus
            mode="single"
            timeZone={SERVICE_TIMEZONE}
            selected={date}
            defaultMonth={date ?? earliestDate}
            onSelect={handleSelect}
            numberOfMonths={1}
            disabled={getDisabledBookableDays(
              getToDateMinDate(bookingType, earliestDate) ?? earliestDate,
            )}
            className="w-full bg-white p-0"
            classNames={calendarClassNames}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
