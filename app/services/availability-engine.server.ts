import { Booking, Car, BookingType, BookingStatus } from "@prisma/client";
import { toZonedTime } from "date-fns-tz";

const ACTIVE_STATUSES = new Set<BookingStatus>([BookingStatus.CONFIRMED, BookingStatus.ACTIVE]);
export const HOUR = 60 * 60 * 1000;

// Buffer time between bookings (in hours) - gives time for car prep, driver swap, and travel to pickup
export const BOOKING_BUFFER_HOURS = 2;

// Lagos timezone (WAT = UTC+1)
const LAGOS_TIMEZONE = "Africa/Lagos";

// Get the hour in Lagos timezone from a UTC date
function getLagosHourFromDate(date: Date): number {
  const lagosDate = toZonedTime(date, LAGOS_TIMEZONE);
  return lagosDate.getHours();
}

export function setHMS(d: Date, h: number, m = 0, s = 0, ms = 0) {
  const x = new Date(d);
  x.setUTCHours(h, m, s, ms);
  return x;
}

// Build a concrete interval for a request
export function buildRequestInterval(input: {
  bookingType: BookingType;
  from: Date;
  to?: Date | null;
}) {
  const { bookingType } = input;
  const from = new Date(input.from);

  if (bookingType === BookingType.DAY) {
    const lagosHour = getLagosHourFromDate(from);

    // Valid range is 7-11 AM Lagos time
    if (lagosHour < 7 || lagosHour > 11) {
      throw new Error("12-hr DAY bookings must start between 07:00 and 11:00 Lagos time");
    }

    const start = from;
    const end = new Date(+start + 12 * HOUR);
    return { start, end };
  }

  if (bookingType === BookingType.NIGHT) {
    const start = setHMS(from, 22); // 22:00 UTC = 23:00 Lagos
    const end = new Date(+start + 6 * HOUR); // 22:00 → 04:00 UTC next day (23:00 → 05:00 Lagos)
    return { start, end };
  }

  // FULL_DAY
  const start = from;
  const end = input.to && input.to > start ? new Date(input.to) : new Date(+start + 24 * HOUR);
  return { start, end };
}

/**
 * Determines if two time intervals overlap.
 *
 * This function supports applying a buffer period (in hours) around the second interval 'b',
 * typically used to enforce a minimum gap between bookings (such as for car preparation, cleaning, etc).
 *
 * @param a - The first interval to compare, with 'start' and 'end' as Date objects (half-open: [start, end)).
 * @param b - The existing/other interval to compare, with 'start' and 'end' as Date objects.
 * @param bufferHours - Optional number of hours to extend 'b' interval (applies symmetrically to both sides). Default is 0 (no buffer).
 * @returns True if the intervals overlap (accounting for optional buffer); otherwise, false.
 */
export function intervalsOverlap(
  a: { start: Date; end: Date },
  b: { start: Date; end: Date },
  bufferHours = 0,
) {
  if (bufferHours <= 0) {
    // No buffer: standard half-open interval overlap (common in scheduling systems)
    return a.start < b.end && a.end > b.start;
  }

  // Buffer in milliseconds
  const bufferMs = bufferHours * HOUR;

  // Extend the 'b' interval by buffer on both sides
  const bufferedStart = new Date(+b.start - bufferMs);
  const bufferedEnd = new Date(+b.end + bufferMs);

  // Check overlap against the buffered interval
  return a.start < bufferedEnd && a.end > bufferedStart;
}

export function buildAllWindowsFrom(from: Date) {
  // Caller should supply an anchor hour in [07..11] Lagos time if they want DAY to pass validation.
  const day = (() => {
    const lagosHour = getLagosHourFromDate(from);
    // If Lagos hour is in valid range (7-11), use the provided time; otherwise default to 6 UTC (7 AM Lagos)
    const anchor = lagosHour >= 7 && lagosHour <= 11 ? from : setHMS(from, 6);
    return buildRequestInterval({ bookingType: BookingType.DAY, from: anchor });
  })();
  const night = buildRequestInterval({ bookingType: BookingType.NIGHT, from });
  const full = buildRequestInterval({ bookingType: BookingType.FULL_DAY, from });
  return { DAY: day, NIGHT: night, FULL_DAY: full };
}

function utcMidnight(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

function addUtcDays(d: Date, days: number) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

// Build per-type windows across an inclusive [from..to] date range (UTC)
function buildAllWindowsForRange(from: Date, to: Date) {
  const start = utcMidnight(from);
  const end = utcMidnight(to);

  const dayWindows: Array<{ start: Date; end: Date }> = [];
  const nightWindows: Array<{ start: Date; end: Date }> = [];
  const fullDayWindows: Array<{ start: Date; end: Date }> = [];

  for (let cursor = new Date(start); +cursor <= +end; cursor = addUtcDays(cursor, 1)) {
    // DAY: 06:00 → 18:00 UTC (07:00 → 19:00 Lagos) for each day
    const dayStart = setHMS(cursor, 6);
    dayWindows.push({ start: dayStart, end: new Date(+dayStart + 12 * HOUR) });

    // NIGHT: 22:00 → 04:00 UTC (23:00 → 05:00 Lagos) for each day
    const nightStart = setHMS(cursor, 22);
    nightWindows.push({ start: nightStart, end: new Date(+nightStart + 6 * HOUR) });

    // FULL_DAY: 05:00 → 05:00 UTC (06:00 → 06:00 Lagos) for each day (earliest valid start)
    const fullStart = setHMS(cursor, 5);
    fullDayWindows.push({ start: fullStart, end: new Date(+fullStart + 24 * HOUR) });
  }

  return { DAY: dayWindows, NIGHT: nightWindows, FULL_DAY: fullDayWindows };
}

function groupByCar(bookings: Booking[]) {
  const m = new Map<string, Array<{ start: Date; end: Date; status: BookingStatus }>>();
  for (const b of bookings) {
    if (!ACTIVE_STATUSES.has(b.status)) continue;
    const arr = m.get(b.carId) ?? [];
    arr.push({ start: b.startDate, end: b.endDate, status: b.status });
    m.set(b.carId, arr);
  }
  return m;
}

export type AvailabilityFlags = { DAY: boolean; NIGHT: boolean; FULL_DAY: boolean };

export function availabilityByType(
  cars: Car[],
  bookings: Booking[],
  opts: { from: Date; to?: Date | null },
): Array<{ carId: string; available: AvailabilityFlags }> {
  const byCar = groupByCar(bookings);

  // Helper to check if any of the candidate windows overlap with any booking interval
  // Applies buffer to existing bookings to enforce minimum gap between bookings
  const overlapsAnyInList = (
    candidates: Array<{ start: Date; end: Date }>,
    list: Array<{ start: Date; end: Date }>,
  ) => candidates.some((w) => list.some((o) => intervalsOverlap(w, o, BOOKING_BUFFER_HOURS)));

  // Single-day (legacy) behavior
  if (!opts.to) {
    const single = buildAllWindowsFrom(opts.from);
    return cars.map((c) => {
      const list = byCar.get(c.id) ?? [];
      const DAY = !overlapsAnyInList([single.DAY], list);
      const NIGHT = !overlapsAnyInList([single.NIGHT], list);
      const FULL_DAY = !overlapsAnyInList([single.FULL_DAY], list);
      return { carId: c.id, available: { DAY, NIGHT, FULL_DAY } };
    });
  }

  // Range-aware windows across [from..to]
  const range = buildAllWindowsForRange(opts.from, opts.to);

  return cars.map((c) => {
    const list = byCar.get(c.id) ?? [];
    const DAY = !overlapsAnyInList(range.DAY, list);
    const NIGHT = !overlapsAnyInList(range.NIGHT, list);

    // If the provided range is exactly 24 hours, treat FULL_DAY as that single window
    // so it aligns with availableCarsForSpecificRequest for FULL_DAY { from, to }.
    const isExact24Hours = opts.to != null && +opts.to - +opts.from === 24 * HOUR;
    const fullDayCandidates = isExact24Hours
      ? [{ start: new Date(opts.from), end: new Date(opts.to as Date) }]
      : range.FULL_DAY;
    const FULL_DAY = !overlapsAnyInList(fullDayCandidates, list);
    return { carId: c.id, available: { DAY, NIGHT, FULL_DAY } };
  });
}

export function availableCarsForSpecificRequest(
  cars: Car[],
  bookings: Booking[],
  req: { bookingType: BookingType; from: Date; to?: Date | null },
): string[] {
  const byCar = groupByCar(bookings);
  const window = buildRequestInterval(req);

  return cars
    .filter((c) => {
      const list = byCar.get(c.id) ?? [];
      return !list.some((o) => intervalsOverlap(window, o, BOOKING_BUFFER_HOURS));
    })
    .map((c) => c.id);
}
