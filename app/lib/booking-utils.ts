import { addDays } from "date-fns/addDays";

import {
  AIRPORT_PICKUP_BOOKING_TYPE,
  type BookingType,
  FULL_DAY_BOOKING_TYPE,
  NIGHT_BOOKING_TYPE,
} from "./booking-types";
import { formatZonedDate, getZonedHour, startOfZonedDay } from "./timezone";

const TIME_FORMAT_REGEX = /^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i;

export function isSameDayCutoffTomorrow(bookingType: BookingType, currentHour: number) {
  if (bookingType === AIRPORT_PICKUP_BOOKING_TYPE || bookingType === FULL_DAY_BOOKING_TYPE) {
    return false;
  }

  if (bookingType === NIGHT_BOOKING_TYPE) {
    return currentHour >= 23;
  }

  return currentHour >= 11;
}

export function getEarliestBookableDate({
  bookingType,
  minDate,
  now = new Date(),
}: {
  readonly bookingType: BookingType;
  readonly minDate?: Date;
  readonly now?: Date;
}) {
  const today = startOfZonedDay(now);
  const earliestDate = isSameDayCutoffTomorrow(bookingType, getZonedHour(now))
    ? addDays(today, 1)
    : today;

  if (!minDate) {
    return earliestDate;
  }

  return new Date(Math.max(startOfZonedDay(minDate).getTime(), earliestDate.getTime()));
}

export function getDisabledBookableDays(minDate: Date) {
  return { before: minDate };
}

export function isValidToDateSelection(
  bookingType: BookingType,
  fromDate: Date | undefined,
  toDate: Date | undefined,
) {
  if (
    (bookingType === NIGHT_BOOKING_TYPE || bookingType === FULL_DAY_BOOKING_TYPE) &&
    fromDate &&
    toDate
  ) {
    return formatZonedDate(fromDate) !== formatZonedDate(toDate);
  }

  return true;
}

export function getToDateMinDate(bookingType: BookingType, fromDate: Date | undefined) {
  if (!fromDate) {
    return undefined;
  }

  if (bookingType === NIGHT_BOOKING_TYPE || bookingType === FULL_DAY_BOOKING_TYPE) {
    return addDays(startOfZonedDay(fromDate), 1);
  }

  return fromDate;
}

export function nextToDateOnFromChange(
  bookingType: BookingType,
  fromDate: Date | undefined,
  currentToDate: Date | undefined,
) {
  if (bookingType === AIRPORT_PICKUP_BOOKING_TYPE) {
    return fromDate;
  }

  if (!fromDate) {
    return undefined;
  }

  if (currentToDate && currentToDate < fromDate) {
    return undefined;
  }

  if (!isValidToDateSelection(bookingType, fromDate, currentToDate)) {
    return undefined;
  }

  return currentToDate;
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
  if (hour < 1 || hour > 12) {
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

export function getPickupTimes(date: Date, bookingType: BookingType = "DAY", now = new Date()) {
  const times: Array<{ label: string; value: string }> = [];
  const startHour = bookingType === FULL_DAY_BOOKING_TYPE ? 5 : 7;
  const endHour = bookingType === FULL_DAY_BOOKING_TYPE ? 23 : 11;

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
