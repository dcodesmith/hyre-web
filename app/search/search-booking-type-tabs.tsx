import { cn } from "cn";
import { BOOKING_TYPE_OPTIONS, BOOKING_TYPE_OPTIONS_MAP, type BookingType } from "~/booking/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

interface SearchBookingTypeTabsProps {
  readonly value: BookingType;
  readonly onValueChange: (value: BookingType) => void;
}

export function SearchBookingTypeTabs({ value, onValueChange }: SearchBookingTypeTabsProps) {
  return (
    <fieldset className="w-full min-w-0">
      <legend className="sr-only">Service type</legend>
      <div className="flex items-stretch justify-between gap-2 md:gap-4">
        {BOOKING_TYPE_OPTIONS.map((type, index) => {
          const option = BOOKING_TYPE_OPTIONS_MAP[type];
          const isActive = value === type;

          return (
            <div key={type} className="contents">
              {index > 0 ? (
                <span className="my-1 w-px shrink-0 bg-gray-300" aria-hidden="true" />
              ) : null}
              <button
                type="button"
                aria-pressed={isActive}
                onClick={() => onValueChange(type)}
                className={cn(
                  "flex h-12 min-w-0 flex-1 flex-col items-center justify-center rounded px-1 text-xs leading-none transition-[background-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:h-13 md:px-3 md:text-sm",
                  isActive
                    ? "bg-white shadow-[0_4px_10px_rgba(0,0,0,0.09)] ring-1 ring-inset ring-gray-400"
                    : "hover:bg-white/70",
                )}
              >
                <span className="whitespace-nowrap font-semibold text-foreground">
                  {option.label}
                </span>
                <span className="mt-2 whitespace-nowrap font-normal text-gray-600">
                  {option.duration}
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

export function SearchBookingTypeSelect({ value, onValueChange }: SearchBookingTypeTabsProps) {
  const selected = BOOKING_TYPE_OPTIONS_MAP[value];

  return (
    <div className="flex h-full w-44 shrink-0 flex-col items-start justify-center gap-2 px-3 py-2">
      <label
        htmlFor="compact-booking-type"
        className="text-sm leading-none font-semibold text-gray-800"
      >
        Booking type
      </label>
      <Select value={value} onValueChange={(next) => onValueChange(next as BookingType)}>
        <SelectTrigger
          id="compact-booking-type"
          className="h-auto w-full justify-start gap-2 rounded-none border-0 bg-transparent p-0 text-sm leading-none font-normal text-gray-800 shadow-none focus-visible:border-transparent focus-visible:ring-0 data-[size=default]:h-auto [&_svg]:ml-auto [&_svg]:size-4 [&_svg]:text-gray-400"
        >
          <SelectValue>{`${selected.label} (${selected.duration})`}</SelectValue>
        </SelectTrigger>
        <SelectContent align="start">
          {BOOKING_TYPE_OPTIONS.map((type) => {
            const option = BOOKING_TYPE_OPTIONS_MAP[type];
            return (
              <SelectItem key={type} value={type}>
                {option.label} ({option.duration})
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}
