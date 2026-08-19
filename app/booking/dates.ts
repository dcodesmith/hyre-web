import { addDays } from "date-fns/addDays";

import {
  AIRPORT_PICKUP_BOOKING_TYPE,
  type BookingType,
  FULL_DAY_BOOKING_TYPE,
  NIGHT_BOOKING_TYPE,
} from "~/booking/types";
import { formatZonedDate, getZonedHour, startOfZonedDay } from "~/time/timezone";

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
