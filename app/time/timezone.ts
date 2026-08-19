/** Current live market. The API `TZ` uses the same IANA zone. */
export const SERVICE_TIMEZONE = "Africa/Lagos";

const dateTimeFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: SERVICE_TIMEZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
  hourCycle: "h23",
});

const dateFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: SERVICE_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const pickerDateFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: SERVICE_TIMEZONE,
  month: "short",
  day: "2-digit",
});

const compactPickerDateFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: SERVICE_TIMEZONE,
  month: "short",
  day: "numeric",
});

function getZonedParts(date: Date) {
  const parts = Object.fromEntries(
    dateTimeFormat.formatToParts(date).map((part) => [part.type, part.value]),
  );

  return {
    year: Number(parts.year),
    month: Number(parts.month) - 1,
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function getTimeZoneOffsetMs(date: Date) {
  const { year, month, day, hour, minute, second } = getZonedParts(date);
  return Date.UTC(year, month, day, hour, minute, second) - date.getTime();
}

export function getZonedHour(date: Date = new Date()) {
  return getZonedParts(date).hour;
}

export function formatZonedDate(date: Date) {
  return dateFormat.format(date);
}

export function formatPickerDate(date: Date) {
  return pickerDateFormat.format(date);
}

export function formatCompactPickerDate(date: Date) {
  return compactPickerDateFormat.format(date);
}

const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parseZonedCalendarDate(value: string) {
  if (!CALENDAR_DATE_PATTERN.test(value)) {
    return undefined;
  }

  const parsed = new Date(`${value}T12:00:00.000Z`);

  if (Number.isNaN(parsed.getTime()) || formatZonedDate(parsed) !== value) {
    return undefined;
  }

  return startOfZonedDay(parsed);
}

/** Midnight in the service timezone as a real UTC instant. */
export function startOfZonedDay(date: Date = new Date()) {
  const calendarDate = formatZonedDate(date);
  const noonUtc = new Date(`${calendarDate}T12:00:00.000Z`);
  return new Date(Date.parse(`${calendarDate}T00:00:00.000Z`) - getTimeZoneOffsetMs(noonUtc));
}
