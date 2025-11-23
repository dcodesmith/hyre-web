import { toZonedTime } from "date-fns-tz";

const LAGOS_TIMEZONE = "Africa/Lagos";

/**
 * Get the current time in Lagos timezone
 * @param date - Optional date to convert (defaults to current time)
 * @returns Date object representing the time in Lagos timezone
 */
export const getLagosTime = (date: Date = new Date()) => {
  return toZonedTime(date, LAGOS_TIMEZONE);
};

/**
 * Get the current hour in Lagos timezone (0-23)
 * @param date - Optional date to get hour from (defaults to current time)
 * @returns Hour in Lagos timezone
 */
export const getLagosHour = (date: Date = new Date()) => {
  return getLagosTime(date).getHours();
};

export { LAGOS_TIMEZONE };
