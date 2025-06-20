import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

const hasTimePassed = (selectedDate: Date, hour: number) => {
  const now = new Date();
  const isSameDay = selectedDate.toLocaleDateString() === now.toLocaleDateString();
  return isSameDay && now.getHours() >= hour;
};

function getPickupTimes(date: Date) {
  return ["7:00 AM", "8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM"]
    .filter((time) => !hasTimePassed(date, Number.parseInt(time.split(":")[0])))
    .map((time) => ({
      label: time,
      value: time,
    }));
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
