import { Booking, Car, BookingType, BookingStatus } from "@prisma/client";

const ACTIVE_STATUSES = new Set<BookingStatus>([
  BookingStatus.PENDING,
  BookingStatus.CONFIRMED,
  BookingStatus.ACTIVE,
]);
export const HOUR = 60 * 60 * 1000;

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
    const startHour = from.getUTCHours();

    if (startHour < 7 || startHour > 11) {
      throw new Error("12-hr DAY bookings must start between 07:00 and 11:00.");
    }

    const start = from;
    const end = new Date(+start + 12 * HOUR);
    return { start, end };
  }

  if (bookingType === BookingType.NIGHT) {
    const start = setHMS(from, 23);
    const end = new Date(+start + 6 * HOUR); // 23:00 → 05:00 next day
    return { start, end };
  }

  // FULL_DAY
  const start = from;
  const end = input.to && input.to > start ? new Date(input.to) : new Date(+start + 24 * HOUR);
  return { start, end };
}

// Standard half-open overlap: [a.start,a.end) vs [b.start,b.end)
export function intervalsOverlap(a: { start: Date; end: Date }, b: { start: Date; end: Date }) {
  return a.start < b.end && a.end > b.start;
}

export function buildAllWindowsFrom(from: Date) {
  // Caller should supply an anchor hour in [07..11] if they want DAY to pass validation.
  const day = (() => {
    const h = from.getUTCHours();
    const anchor = h >= 7 && h <= 11 ? from : setHMS(from, 7);
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
    // DAY: 07:00 → 19:00 for each day
    const dayStart = setHMS(cursor, 7);
    dayWindows.push({ start: dayStart, end: new Date(+dayStart + 12 * HOUR) });

    // NIGHT: 23:00 → 05:00 next day for each day
    const nightStart = setHMS(cursor, 23);
    nightWindows.push({ start: nightStart, end: new Date(+nightStart + 6 * HOUR) });

    // FULL_DAY: 00:00 → 24:00 for each day
    const fullStart = setHMS(cursor, 0);
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
  const overlapsAnyInList = (
    candidates: Array<{ start: Date; end: Date }>,
    list: Array<{ start: Date; end: Date }>,
  ) => candidates.some((w) => list.some((o) => intervalsOverlap(w, o)));

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
      return !list.some((o) => intervalsOverlap(window, o));
    })
    .map((c) => c.id);
}
