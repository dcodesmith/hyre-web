import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { getLagosTime } from "~/utils/timezone";

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
  readonly className?: string;
  readonly bookingType?: string;
  readonly onValueChange?: (value: string) => void;
}

export function BookingTimeSelect({
  date,
  defaultValue,
  className,
  bookingType = "DAY",
  onValueChange,
}: BookingTimeSelectProps) {
  return (
    <Select name="pickupTime" defaultValue={defaultValue} onValueChange={onValueChange}>
      <SelectTrigger className={`w-full rounded ${className}`}>
        <SelectValue placeholder="Select pickup time" />
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
}
