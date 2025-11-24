import { describe, it, expect } from "vitest";
import {
  buildRequestInterval,
  availabilityByType,
  availableCarsForSpecificRequest,
  HOUR,
  BOOKING_BUFFER_HOURS,
} from "./availability-engine.server";
import { BookingType, BookingStatus, Booking, Car } from "@prisma/client";
import { makeCar, makeBooking } from "~/test/utils/builders";

const d = (s: string) => new Date(s);

// Helper to create a confirmed booking with common defaults
const confirmedBooking = (
  carId: string,
  startDate: string,
  endDate: string,
  options?: { id?: string; type?: BookingType; status?: BookingStatus }
) =>
  makeBooking({
    id: options?.id ?? `b-${carId}`,
    carId,
    status: options?.status ?? BookingStatus.CONFIRMED,
    startDate: d(startDate),
    endDate: d(endDate),
    ...(options?.type && { type: options.type }),
  });

// Helper to check availability for a single car
const checkAvailability = (
  carId: string,
  bookings: Booking[],
  opts: { from: Date; to?: Date }
) => {
  const cars = [makeCar({ id: carId })] as Car[];
  const [res] = availabilityByType(cars, bookings as Booking[], opts);
  return res.available;
};

// Helper to check if a specific booking request is available
const canBook = (
  carId: string,
  bookings: Booking[],
  request: { bookingType: BookingType; from: Date; to?: Date }
) => {
  const cars = [makeCar({ id: carId })] as Car[];
  return availableCarsForSpecificRequest(cars, bookings as Booking[], request);
};

// Common availability expectations
const ALL_AVAILABLE = { DAY: true, NIGHT: true, FULL_DAY: true };
const ALL_UNAVAILABLE = { DAY: false, NIGHT: false, FULL_DAY: false };

describe("pure availability engine", () => {
  it("Should build correct windows", () => {
    // Verify that buildRequestInterval creates windows of the correct duration:
    // DAY:      09:00 → 21:00 (12 hours)
    // NIGHT:    23:00 → 05:00 (6 hours)
    // FULL_DAY: 09:00 → 09:00 (24 hours)
    const from = d("2025-10-10T09:00:00.000Z");

    const day = buildRequestInterval({ bookingType: BookingType.DAY, from });
    expect((+day.end - +day.start) / HOUR).toBe(12);

    const night = buildRequestInterval({ bookingType: BookingType.NIGHT, from });
    expect((+night.end - +night.start) / HOUR).toBe(6);

    const full = buildRequestInterval({ bookingType: BookingType.FULL_DAY, from });
    expect((+full.end - +full.start) / HOUR).toBe(24);
  });

  it("Should set per-type availability flags per business rules", () => {
    // Scenario:
    // - Mix of DAY, NIGHT, and FULL_DAY bookings across different cars on Oct 10–11.
    // - With 2-hour buffer between bookings
    // Expectations (half-open intervals with buffer):
    // - carA has a DAY booking (07:00–19:00) on the 10th, so DAY is unavailable; NIGHT is available
    //   (4hr gap from 19:00 to 23:00); FULL_DAY is unavailable because it overlaps 07:00–19:00.
    // - carB has a NIGHT booking (23:00→05:00), so NIGHT is unavailable; DAY is unavailable due to
    //   2hr buffer (NIGHT ends 05:00, buffer extends to 07:00, DAY starts 07:00 - edge case);
    //   FULL_DAY (06:00 start) is unavailable due to buffer (only 1hr gap from 05:00).
    // - carC has a 24h span (10:00→10:00 next day) which blocks all types on that anchor.
    // - carD has no bookings and is fully available.
    const bookings = [
      makeBooking({
        id: "b-carA",
        carId: "carA",
        status: BookingStatus.CONFIRMED,
        startDate: d("2025-10-10T07:00:00.000Z"),
        endDate: d("2025-10-10T19:00:00.000Z"),
      }),
      makeBooking({
        id: "b-carB",
        carId: "carB",
        status: BookingStatus.CONFIRMED,
        startDate: d("2025-10-10T23:00:00.000Z"),
        endDate: d("2025-10-11T05:00:00.000Z"),
      }),
      makeBooking({
        id: "b-carC",
        carId: "carC",
        status: BookingStatus.ACTIVE,
        startDate: d("2025-10-10T10:00:00.000Z"),
        endDate: d("2025-10-11T10:00:00.000Z"),
      }),
    ];

    const cars = [
      makeCar({ id: "carA" }),
      makeCar({ id: "carB" }),
      makeCar({ id: "carC" }),
      makeCar({ id: "carD" }),
    ];

    const anchor = d("2025-10-10T10:00:00.000Z");
    const results = availabilityByType(cars, bookings, { from: anchor });
    const byId = Object.fromEntries(results.map((r) => [r.carId, r.available]));

    expect(byId.carA).toEqual({ DAY: false, NIGHT: true, FULL_DAY: false });
    // carB: NIGHT 23:00-05:00, with symmetric buffer extends to 21:00-07:00
    // DAY window with anchor 10:00 is 10:00-22:00: ends at 22:00 which is only 1hr before 23:00, so DAY is blocked
    // FULL_DAY starts at 10:00 which overlaps with buffered NIGHT ending at 07:00
    expect(byId.carB).toEqual({ DAY: false, NIGHT: false, FULL_DAY: false });
    expect(byId.carC).toEqual({ DAY: false, NIGHT: false, FULL_DAY: false });
    expect(byId.carD).toEqual({ DAY: true, NIGHT: true, FULL_DAY: true });
  });

  it("Should treat same-day [from..to] like single-day availability", () => {
    // Scenario:
    // - Single calendar day search; from and to are both on Oct 10.
    // Expectations:
    // - For carA, a DAY booking (07:00–19:00) blocks DAY and overlaps the FULL_DAY window for the day;
    //   NIGHT remains available. carB has no bookings and remains fully available.
    const bookings = [
      makeBooking({
        id: "b-1",
        carId: "carA",
        status: BookingStatus.CONFIRMED,
        startDate: d("2025-10-10T07:00:00.000Z"),
        endDate: d("2025-10-10T19:00:00.000Z"),
      }),
    ];

    const cars = [makeCar({ id: "carA" }), makeCar({ id: "carB" })];
    const from = d("2025-10-10T09:00:00.000Z");
    const to = d("2025-10-10T09:00:00.000Z");

    const results = availabilityByType(cars, bookings, { from, to });
    const byId = Object.fromEntries(results.map((r) => [r.carId, r.available]));

    expect(byId.carA).toEqual({ DAY: false, NIGHT: true, FULL_DAY: false });
    expect(byId.carB).toEqual({ DAY: true, NIGHT: true, FULL_DAY: true });
  });

  it("Should block a type over a multi-day range if any day overlaps", () => {
    // Scenario:
    // - Multi-day range 10th→12th; carX has a DAY booking on the 11th (07:00–19:00).
    // Expectations:
    // - DAY is unavailable because one day's window overlaps within the range.
    // - FULL_DAY is also unavailable in range mode because FULL_DAY windows are 06:00→06:00 per day,
    //   which overlap the 11th's 07:00–19:00.
    // - NIGHT remains available since there is no night overlap.
    const bookings = [
      confirmedBooking("carX", "2025-10-11T07:00:00.000Z", "2025-10-11T19:00:00.000Z", { id: "b-day-mid" }),
    ];

    const result = checkAvailability("carX", bookings, {
      from: d("2025-10-10T10:00:00.000Z"),
      to: d("2025-10-12T10:00:00.000Z"),
    });
    expect(result).toEqual({ DAY: false, NIGHT: true, FULL_DAY: false });
  });

  it("Should include last night spillover at 'to' (23:00 'to' → 05:00 next day)", () => {
    // Scenario:
    // - Multi-day range ending on the 12th; there is a NIGHT booking on the 12th (23:00→05:00 next day).
    // Expectations:
    // - NIGHT is unavailable due to spillover handling through 05:00 after 'to'.
    // - FULL_DAY for the 12th (06:00→06:00) overlaps 23:00–05:00 and is therefore unavailable.
    // - DAY remains available since no 07:00–19:00 overlap exists.
    const bookings = [
      confirmedBooking("carN", "2025-10-12T23:00:00.000Z", "2025-10-13T05:00:00.000Z", {
        id: "b-night-to",
        type: BookingType.NIGHT,
      }),
    ];

    const result = checkAvailability("carN", bookings, {
      from: d("2025-10-10T10:00:00.000Z"),
      to: d("2025-10-12T10:00:00.000Z"),
    });
    expect(result).toEqual({ DAY: true, NIGHT: false, FULL_DAY: false });
  });

  it("Should align FULL_DAY availability for exact 24h [from..to] with specific request", () => {
    // Scenario:
    // - Exact 24h range from 10:00 UTC on the 10th to 10:00 UTC on the 11th, with a prior-night spillover.
    // - Prior night ends at 04:00 UTC (05:00 Lagos), buffer extends to 06:00 UTC (07:00 Lagos)
    // Expectations:
    // - In range mode, FULL_DAY is anchored to the exact [from..to] window when the span is 24h,
    //   matching the specific request behavior.
    // - The prior-night 22:00→04:00 UTC does not overlap the 10:00→10:00 FULL_DAY window.
    // - DAY window starts at 06:00 UTC (7 AM Lagos), which is at the edge of the buffer (06:00 UTC)
    //   from night ending at 04:00 UTC. With half-open intervals, this is blocked.
    // - Both availabilityByType and availableCarsForSpecificRequest should agree on availability.
    const bookings = [
      makeBooking({
        id: "b-night-prev",
        carId: "carG",
        status: BookingStatus.CONFIRMED,
        startDate: d("2025-10-09T22:00:00.000Z"), // 23:00 Lagos
        endDate: d("2025-10-10T04:00:00.000Z"),   // 05:00 Lagos
        type: BookingType.NIGHT,
      }),
    ];

    const cars = [makeCar({ id: "carG" })];
    const from = d("2025-10-10T10:00:00.000Z");
    const to = d("2025-10-11T10:00:00.000Z"); // exact 24h window

    // availabilityByType should mark FULL_DAY available
    // DAY window (06:00-18:00 UTC) starts at buffered end (06:00 UTC)
    // With half-open intervals, 06:00 < 06:00 is false, so DAY is available
    const [res] = availabilityByType(cars, bookings, { from, to });
    expect(res.available).toEqual({ DAY: true, NIGHT: true, FULL_DAY: true });

    // availableCarsForSpecificRequest should also approve the specific FULL_DAY request
    const ids = availableCarsForSpecificRequest(cars, bookings, {
      bookingType: BookingType.FULL_DAY,
      from,
      to,
    });
    expect(ids).toEqual(["carG"]);
  });

  it("Should mark FULL_DAY unavailable if any day overlaps a 24h interval", () => {
    // This test verifies that if there is an existing FULL_DAY booking that overlaps with any part
    // of a requested date range, the FULL_DAY availability flag will be false for that car.
    const bookings = [
      confirmedBooking("carF", "2025-10-10T10:00:00.000Z", "2025-10-11T10:00:00.000Z", {
        id: "b-full",
        type: BookingType.FULL_DAY,
      }),
    ];

    const result = checkAvailability("carF", bookings, {
      from: d("2025-10-10T10:00:00.000Z"),
      to: d("2025-10-12T10:00:00.000Z"),
    });
    expect(result).toEqual(ALL_UNAVAILABLE);
  });

  it("Should ignore bookings with statuses outside ACTIVE_STATUSES", () => {
    // Scenario:
    // - A CANCELLED booking exists in the date; only PENDING/CONFIRMED/ACTIVE should affect availability.
    const bookings = [
      confirmedBooking("carZ", "2025-10-10T07:00:00.000Z", "2025-10-10T19:00:00.000Z", {
        id: "b-cancelled",
        status: BookingStatus.CANCELLED,
      }),
    ];

    const result = checkAvailability("carZ", bookings, {
      from: d("2025-10-10T10:00:00.000Z"),
      to: d("2025-10-10T10:00:00.000Z"),
    });
    expect(result).toEqual(ALL_AVAILABLE);
  });

  it("Should treat reversed range (from > to) as all available (no windows)", () => {
    // Scenario:
    // - from is later than to, indicating an invalid or reversed range.
    const bookings = [
      confirmedBooking("carR", "2025-10-10T07:00:00.000Z", "2025-10-10T19:00:00.000Z", { id: "b-day" }),
    ];

    const result = checkAvailability("carR", bookings, {
      from: d("2025-10-12T10:00:00.000Z"),
      to: d("2025-10-11T10:00:00.000Z"),
    });
    expect(result).toEqual(ALL_AVAILABLE);
  });

  it("Should throw for DAY if start hour is outside 07..11 Lagos time", () => {
    // Scenario:
    // - DAY requests must be anchored between 07:00 and 11:00 inclusive (Lagos time).
    // Expectations:
    // - Requests at 06:00 Lagos (05:00 UTC) or 12:00 Lagos (11:00 UTC) throw validation errors.
    expect(() =>
      buildRequestInterval({ bookingType: BookingType.DAY, from: d("2025-10-10T05:00:00.000Z") }),
    ).toThrowError();
    expect(() =>
      buildRequestInterval({ bookingType: BookingType.DAY, from: d("2025-10-10T11:00:00.000Z") }),
    ).toThrowError();
  });

  it("Should treat adjacent intervals as overlapping due to buffer (e.g., DAY ending 22:00 vs NIGHT starting 22:00)", () => {
    // Scenario:
    // - A DAY window ending at 22:00 UTC (11 PM Lagos) and a NIGHT window starting at 22:00 UTC on the same day.
    // - With 2-hour buffer: DAY ends 22:00, buffered to 00:00 next day
    // Expectations:
    // - NIGHT starting at 22:00 is blocked because 22:00 < 00:00 (buffered end)
    const fromDay = d("2025-10-10T10:00:00.000Z"); // 11 AM Lagos → DAY 10:00→22:00 UTC

    const day = buildRequestInterval({ bookingType: BookingType.DAY, from: fromDay });

    const fromNight = d("2025-10-10T12:00:00.000Z"); // NIGHT 22→04 UTC

    // Construct a booking that ends exactly at 22:00 UTC
    const bookings = [
      makeBooking({
        id: "b-carX",
        carId: "carX",
        status: BookingStatus.CONFIRMED,
        startDate: day.start,
        endDate: day.end,
      }),
    ];

    // The night request should NOT be available due to 2hr buffer (22:00 < 00:00 buffered end)
    const ids = availableCarsForSpecificRequest([makeCar({ id: "carX" })], bookings, {
      bookingType: BookingType.NIGHT,
      from: fromNight,
    });
    expect(ids).toEqual([]);
  });

  it("Should allow adjacent intervals when there is sufficient gap (e.g., DAY ending 19:00 vs NIGHT starting 23:00)", () => {
    // Scenario:
    // - A DAY window ending at 19:00 and a NIGHT window starting at 23:00 on the same day.
    // - With 2-hour buffer: DAY ends 19:00, buffered to 21:00
    // Expectations:
    // - NIGHT starting at 23:00 is available because 23:00 >= 21:00 (buffered end)
    const fromDay = d("2025-10-10T07:00:00.000Z"); // DAY 07→19

    const day = buildRequestInterval({ bookingType: BookingType.DAY, from: fromDay });

    const fromNight = d("2025-10-10T12:00:00.000Z"); // NIGHT 23→05

    // Construct a booking that ends at 19:00
    const bookings = [
      makeBooking({
        id: "b-carY",
        carId: "carY",
        status: BookingStatus.CONFIRMED,
        startDate: day.start,
        endDate: day.end,
      }),
    ];

    // The night request should be available (4hr gap from 19:00 to 23:00)
    const ids = availableCarsForSpecificRequest([makeCar({ id: "carY" })], bookings, {
      bookingType: BookingType.NIGHT,
      from: fromNight,
    });
    expect(ids).toEqual(["carY"]);
  });

  it("Should not block 12th daytime or night due to night spillover on 11th (23→05)", () => {
    // Scenario:
    // - A night booking ends at 05:00 on the 12th due to spillover from the 11th.
    // - With 2-hour buffer: NIGHT ends 05:00, buffered to 07:00
    // Expectations:
    // - DAY on 12th (07:00 start) is available (half-open: 07:00 >= 07:00 buffered end)
    // - NIGHT on 12th (23:00 start) is available (17hr gap from 05:00)
    // - FULL_DAY anchored at 10:00 (5hr gap from 05:00) is available
    const bookings = [
      makeBooking({
        id: "b-carN",
        carId: "carN",
        status: BookingStatus.CONFIRMED,
        startDate: d("2025-10-11T23:00:00.000Z"),
        endDate: d("2025-10-12T05:00:00.000Z"),
      }),
    ];

    const anchor12th = d("2025-10-12T10:00:00.000Z");
    const carsN = [makeCar({ id: "carN" })];

    const [flags] = availabilityByType(carsN, bookings, { from: anchor12th });
    // When using single anchor (no 'to'), FULL_DAY uses the anchor time (10:00), not 06:00
    // 10:00 start gives 5hr gap from 05:00 end, so it's available
    expect(flags.available).toEqual({ DAY: true, NIGHT: true, FULL_DAY: true });

    // Specific requests on 12th
    const canDay = availableCarsForSpecificRequest(carsN, bookings, {
      bookingType: BookingType.DAY,
      from: d("2025-10-12T07:00:00.000Z"),
    });
    expect(canDay).toEqual(["carN"]);

    const canNight = availableCarsForSpecificRequest(carsN, bookings, {
      bookingType: BookingType.NIGHT,
      from: d("2025-10-12T12:00:00.000Z"), // anchors NIGHT 23→05 of 12th→13th
    });
    expect(canNight).toEqual(["carN"]);

    // FULL_DAY starting at 06:00 should be blocked due to buffer (only 1hr gap)
    const canFull = availableCarsForSpecificRequest(carsN, bookings, {
      bookingType: BookingType.FULL_DAY,
      from: d("2025-10-12T06:00:00.000Z"),
    });
    expect(canFull).toEqual([]);

    // But FULL_DAY starting at 07:00 or later should be allowed (2hr gap)
    const canFullLater = availableCarsForSpecificRequest(carsN, bookings, {
      bookingType: BookingType.FULL_DAY,
      from: d("2025-10-12T07:00:00.000Z"),
    });
    expect(canFullLater).toEqual(["carN"]);
  });

  it("Should, on the 11th, block all types when there is a night 11th 23→12th 05 due to anchor time", () => {
    // Scenario:
    // - A night booking starts at 23:00 on the 11th and ends 05:00 on the 12th.
    // - With symmetric buffer: NIGHT 23:00-05:00 extends to 21:00-07:00
    // Expectations:
    // - DAY window with anchor 10:00 is 10:00-22:00: ends at 22:00 which is only 1hr before 23:00, so blocked
    // - NIGHT and FULL_DAY are unavailable due to overlap.
    const bookings = [
      confirmedBooking("carM", "2025-10-11T23:00:00.000Z", "2025-10-12T05:00:00.000Z"),
    ];

    const result = checkAvailability("carM", bookings, { from: d("2025-10-11T10:00:00.000Z") });
    expect(result).toEqual({ DAY: false, NIGHT: false, FULL_DAY: false });
  });

  it("Should detect exact duplicate intervals as overlapping", () => {
    // Scenario:
    // - A specific request matches an existing booking with identical start and end.
    const bookings = [
      confirmedBooking("carQ", "2025-10-10T23:00:00.000Z", "2025-10-11T05:00:00.000Z"),
    ];

    const result = canBook("carQ", bookings, {
      bookingType: BookingType.NIGHT,
      from: d("2025-10-10T23:00:00.000Z"), // Same as existing booking
    });
    expect(result).toEqual([]);
  });

  it("Should treat night-to-night adjacency across days as non-overlapping (11th 23→12th 05 vs 12th 23→13th 05)", () => {
    // Scenario:
    // - Two NIGHT windows on consecutive days with 2-hour buffer.
    // - Second NIGHT starts at 23:00 which is well after 07:00 buffered end (18hr gap)
    const bookings = [
      confirmedBooking("carR", "2025-10-11T23:00:00.000Z", "2025-10-12T05:00:00.000Z"),
    ];

    const result = canBook("carR", bookings, {
      bookingType: BookingType.NIGHT,
      from: d("2025-10-12T23:00:00.000Z"), // NIGHT 12th 23→13th 05
    });
    expect(result).toEqual(["carR"]);
  });

  it("Should enforce the configured buffer between bookings", () => {
    // Verify that BOOKING_BUFFER_HOURS is being applied correctly
    expect(BOOKING_BUFFER_HOURS).toBe(2);

    const bookings = [
      confirmedBooking("carBuffer", "2025-10-10T23:00:00.000Z", "2025-10-11T05:00:00.000Z", {
        id: "b-buffer-test",
      }),
    ];

    // DAY at 07:00 should be allowed (exactly 2hr gap, half-open interval)
    expect(canBook("carBuffer", bookings, {
      bookingType: BookingType.DAY,
      from: d("2025-10-11T07:00:00.000Z"),
    })).toEqual(["carBuffer"]);

    // FULL_DAY at 06:00 should be blocked (only 1hr gap)
    expect(canBook("carBuffer", bookings, {
      bookingType: BookingType.FULL_DAY,
      from: d("2025-10-11T06:00:00.000Z"),
    })).toEqual([]);

    // FULL_DAY at 07:00 should be allowed (2hr gap)
    expect(canBook("carBuffer", bookings, {
      bookingType: BookingType.FULL_DAY,
      from: d("2025-10-11T07:00:00.000Z"),
    })).toEqual(["carBuffer"]);
  });
});
