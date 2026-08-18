export const LAGOS_TIMEZONE = "Africa/Lagos";

const lagosDateTimeFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: LAGOS_TIMEZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  hourCycle: "h23",
});

const lagosDateFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: LAGOS_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const pickerDateFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: LAGOS_TIMEZONE,
  month: "short",
  day: "2-digit",
});

function getLagosParts(date: Date) {
  const parts = Object.fromEntries(
    lagosDateTimeFormat.formatToParts(date).map((part) => [part.type, part.value]),
  );

  return {
    year: Number(parts.year),
    month: Number(parts.month) - 1,
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

export function getLagosTime(date: Date = new Date()) {
  const { year, month, day, hour, minute } = getLagosParts(date);
  return new Date(year, month, day, hour, minute);
}

export function getLagosHour(date: Date = new Date()) {
  return getLagosParts(date).hour;
}

export function formatLagosDate(date: Date) {
  return lagosDateFormat.format(date);
}

export function formatPickerDate(date: Date) {
  return pickerDateFormat.format(date);
}

/** Midnight in Africa/Lagos as a real instant. Nigeria stays on UTC+1. */
export function startOfLagosDay(date: Date = new Date()) {
  return new Date(`${formatLagosDate(date)}T00:00:00+01:00`);
}
