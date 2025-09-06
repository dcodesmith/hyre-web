import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

const hasTimePassed = (selectedDate: Date, hour: number) => {
  const now = new Date();
  const selectedDateStart = new Date(selectedDate);
  selectedDateStart.setHours(0, 0, 0, 0);
  const nowDateStart = new Date(now);
  nowDateStart.setHours(0, 0, 0, 0);

  const isSameDay = selectedDateStart.getTime() === nowDateStart.getTime();
  if (!isSameDay) return false;

  const targetTime = new Date(selectedDate);
  targetTime.setHours(hour, 0, 0, 0);

  return now >= targetTime;
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
    // For regular day bookings, use existing logic with 30-minute intervals
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
}

export function BookingTimeSelect({
  date,
  defaultValue,
  className,
  bookingType = "DAY",
}: BookingTimeSelectProps) {
  return (
    <Select name="pickupTime" defaultValue={defaultValue}>
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
