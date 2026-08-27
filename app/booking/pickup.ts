import { type BookingType, FULL_DAY_BOOKING_TYPE, NIGHT_BOOKING_TYPE } from "~/booking/types";
import { formatZonedDate, getZonedHour } from "~/time/timezone";

const TIME_FORMAT_REGEX = /^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i;

export function parsePickupClock(time: string | undefined) {
  const match = TIME_FORMAT_REGEX.exec(time?.trim() ?? "");

  if (!match) {
    return undefined;
  }

  let hour = Number.parseInt(match[1], 10);
  const minute = match[2] ? Number.parseInt(match[2], 10) : 0;
  const period = match[3].toUpperCase();

  if (hour < 1 || hour > 12 || minute > 59) {
    return undefined;
  }

  if (period === "PM" && hour !== 12) {
    hour += 12;
  }

  if (period === "AM" && hour === 12) {
    hour = 0;
  }

  return { hour, minute };
}

export function normalizePickupTime(time: string | undefined) {
  if (!time) {
    return undefined;
  }

  const trimmed = time.trim();
  const match = TIME_FORMAT_REGEX.exec(trimmed);

  if (!match) {
    return trimmed;
  }

  const hour = Number.parseInt(match[1], 10);
  const minute = match[2] ? Number.parseInt(match[2], 10) : 0;
  if (hour < 1 || hour > 12 || minute !== 0) {
    return trimmed;
  }

  return `${hour} ${match[3].toUpperCase()}`;
}

function formatHourLabel(hour: number) {
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12} ${hour < 12 ? "AM" : "PM"}`;
}

function hasPickupHourPassed(selectedDate: Date, hour: number, now: Date) {
  return formatZonedDate(now) === formatZonedDate(selectedDate) && getZonedHour(now) >= hour;
}

function getPickupHourRange(bookingType: BookingType): readonly [number, number] {
  if (bookingType === FULL_DAY_BOOKING_TYPE) {
    return [5, 23];
  }

  if (bookingType === NIGHT_BOOKING_TYPE) {
    return [23, 23];
  }

  return [7, 11];
}

export function getPickupTimes(date: Date, bookingType: BookingType = "DAY", now = new Date()) {
  const times: Array<{ label: string; value: string }> = [];
  const [startHour, endHour] = getPickupHourRange(bookingType);

  for (let hour = startHour; hour <= endHour; hour += 1) {
    if (!hasPickupHourPassed(date, hour, now)) {
      const timeLabel = formatHourLabel(hour);
      times.push({
        label: timeLabel,
        value: timeLabel,
      });
    }
  }

  return times;
}

export function nextPickupTimeOnFromChange({
  bookingType,
  fromDate,
  currentPickupTime,
  fallbackDate,
  now = new Date(),
}: {
  readonly bookingType: BookingType;
  readonly fromDate: Date | undefined;
  readonly currentPickupTime: string | undefined;
  readonly fallbackDate: Date;
  readonly now?: Date;
}) {
  const normalizedPickupTime = normalizePickupTime(currentPickupTime);

  if (!normalizedPickupTime) {
    return undefined;
  }

  const availableTimes = getPickupTimes(fromDate ?? fallbackDate, bookingType, now);
  return availableTimes.some((time) => time.value === normalizedPickupTime)
    ? normalizedPickupTime
    : undefined;
}
