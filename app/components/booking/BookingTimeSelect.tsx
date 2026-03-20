import { getLagosTime } from "~/utils/timezone";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { cn } from "~/lib/utils";

const hasTimePassed = (selectedDate: Date, hour: number) => {
  // Use Lagos-local clock consistently
  const nowLagos = getLagosTime();
  const selectedLagos = getLagosTime(selectedDate);
  const sameDay =
    nowLagos.getFullYear() === selectedLagos.getFullYear() &&
    nowLagos.getMonth() === selectedLagos.getMonth() &&
    nowLagos.getDate() === selectedLagos.getDate();
  if (!sameDay) return false;
  return nowLagos.getHours() >= hour;
};

/**
 * Normalizes a time string from URL format to match toLocaleTimeString output
 * toLocaleTimeString with hour: 'numeric' produces "8 AM" (no :00)
 */
function normalizeTimeFormat(time: string | undefined): string | undefined {
  if (!time) return undefined;

  const trimmed = time.trim();

  // Match patterns like "9 AM", "9AM", "11 PM", "9:00 AM" etc.
  const timeRegex = /^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i;
  const match = timeRegex.exec(trimmed);
  if (match) {
    const hour = Number.parseInt(match[1], 10);
    if (hour < 1 || hour > 12) {
      return trimmed; // Return as-is if hour is out of range
    }
    const period = match[3].toUpperCase(); // match[3] is the AM/PM group, match[2] is optional minutes

    // Format as "H AM/PM" to match toLocaleTimeString('en-US', { hour: 'numeric', hour12: true })
    return `${hour} ${period}`;
  }

  // If it doesn't match expected patterns, return as is
  return trimmed;
}

function getPickupTimes(date: Date, bookingType = "DAY", startHour = 7, endHour = 11) {
  const times = [];

  if (bookingType === "FULL_DAY") {
    // For 24-hour bookings, provide hourly options from 7 AM to 11 PM
    for (let hour = 5; hour <= 23; hour++) {
      const timeLabel = new Date(2000, 0, 1, hour).toLocaleTimeString("en-US", {
        hour: "numeric",
        hour12: true,
      });

      if (!hasTimePassed(date, hour)) {
        times.push({
          label: timeLabel,
          value: timeLabel,
        });
      }
    }
  } else {
    for (let hour = startHour; hour <= endHour; hour++) {
      const timeLabel = new Date(2000, 0, 1, hour).toLocaleTimeString("en-US", {
        hour: "numeric",
        hour12: true,
      });

      if (!hasTimePassed(date, hour)) {
        times.push({
          label: timeLabel,
          value: timeLabel,
        });
      }
    }
  }

  return times;
}

interface BookingTimeSelectProps {
  readonly date: Date;
  readonly defaultValue?: string;
  readonly value?: string;
  readonly className?: string;
  readonly bookingType?: string;
  readonly onValueChange?: (value: string) => void;
  /** Container class for inline-style usage (e.g., Airbnb-style search bar) */
  readonly containerClassName?: string;
  /** Label class for inline-style usage */
  readonly labelClassName?: string;
  /** Whether to show the inline label. Set to false when using external Label component. */
  readonly showLabel?: boolean;
  /** Custom placeholder text (defaults to "Select pickup time") */
  readonly placeholder?: string;
}

export function BookingTimeSelect({
  date,
  defaultValue,
  value,
  className,
  bookingType = "DAY",
  onValueChange,
  containerClassName,
  labelClassName = "text-xs font-semibold text-gray-700 leading-tight",
  showLabel = false,
  placeholder = "Select pickup time",
}: BookingTimeSelectProps) {
  // Normalize the value to match the select's format
  const normalizedValue = value ? normalizeTimeFormat(value) : undefined;
  const normalizedDefaultValue = defaultValue ? normalizeTimeFormat(defaultValue) : undefined;

  // Determine if we're in controlled or uncontrolled mode
  // Controlled: value prop is provided
  // Uncontrolled: value prop is not provided, use defaultValue
  const selectValueProp = normalizedValue;
  const selectDefaultValue = normalizedValue === undefined ? normalizedDefaultValue : undefined;

  const selectElement = (
    <Select
      name="pickupTime"
      value={selectValueProp}
      defaultValue={selectDefaultValue}
      onValueChange={onValueChange}
    >
      <SelectTrigger
        aria-label="Select pickup time"
        className={cn(
          containerClassName
            ? "w-full justify-start text-left font-normal p-0 h-auto min-h-0 hover:bg-transparent focus:ring-0 shadow-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 border-0 [&>svg]:hidden text-sm leading-tight"
            : "w-full rounded",
          className,
        )}
      >
        <SelectValue
          placeholder={
            containerClassName ? <span className="text-gray-500">{placeholder}</span> : placeholder
          }
        />
      </SelectTrigger>
      <SelectContent>
        {getPickupTimes(date, bookingType).map(({ label, value }) => (
          <SelectItem key={value} value={value}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  // If no container class provided, render plain select (backward compatible)
  if (!containerClassName) {
    return selectElement;
  }

  // Inline-style with optional label (for Airbnb-style search)
  return (
    <div className={containerClassName}>
      {showLabel && <span className={labelClassName}>Pickup Time</span>}
      {selectElement}
    </div>
  );
}
