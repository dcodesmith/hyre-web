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

function getPickupTimes(date: Date, startHour = 7, endHour = 11) {
  const times = [];
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
  return times;
}

interface BookingTimeSelectProps {
  date: Date;
  defaultValue?: string;
  className?: string;
}

export function BookingTimeSelect({ date, defaultValue, className }: BookingTimeSelectProps) {
  return (
    <Select name="pickupTime" defaultValue={defaultValue}>
      <SelectTrigger className={`w-full rounded ${className}`}>
        <SelectValue placeholder="Select pickup time" />
      </SelectTrigger>
      <SelectContent>
        {getPickupTimes(date).map(({ label, value }) => (
          <SelectItem key={value} value={value}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
