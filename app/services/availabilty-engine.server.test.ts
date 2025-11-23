import { describe, it, expect } from "vitest";
import {
  buildRequestInterval,
  availabilityByType,
  availableCarsForSpecificRequest,
  HOUR,
} from "./availability-engine.server";
import { BookingType, BookingStatus } from "@prisma/client";
import { makeCar, makeBooking } from "~/test/utils/builders";

const d = (s: string) => new Date(s);

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
    // Expectations (half-open intervals):
    // - carA has a DAY booking (07:00–19:00) on the 10th, so DAY is unavailable; NIGHT is available;
    //   FULL_DAY is unavailable because a 10:00→10:00 window overlaps 07:00–19:00.
    // - carB has a NIGHT booking (23:00→05:00), so NIGHT is unavailable that night; DAY does not overlap;
    //   FULL_DAY overlaps due to the 23:00–24:00 portion.
    // - carC has a 24h span (10:00→10:00 next day) which blocks all types on that anchor.
    // - carD has no bookings and is fully available.
    // Bookings:
    // carA: DAY 07→19 (blocks DAY; doesn't block NIGHT 23→05; overlaps FULL_DAY 10→10)
    // carB: NIGHT 23→05 (blocks NIGHT; overlaps FULL_DAY 10→10; not DAY 10→22)
    // carC: FULL_DAY 10→10 (blocks all)
    // carD: none (all available)
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
    expect(byId.carB).toEqual({ DAY: true, NIGHT: false, FULL_DAY: false });
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
    // - FULL_DAY is also unavailable in range mode because FULL_DAY windows are 00:00→24:00 per day,
    //   which overlap the 11th's 07:00–19:00.
    // - NIGHT remains available since there is no night overlap.
    const bookings = [
      makeBooking({
        id: "b-day-mid",
        carId: "carX",
        status: BookingStatus.CONFIRMED,
        startDate: d("2025-10-11T07:00:00.000Z"),
        endDate: d("2025-10-11T19:00:00.000Z"),
      }),
    ];

    const cars = [makeCar({ id: "carX" })];
    const from = d("2025-10-10T10:00:00.000Z");
    const to = d("2025-10-12T10:00:00.000Z");

    const [res] = availabilityByType(cars, bookings, { from, to });
    expect(res.available).toEqual({ DAY: false, NIGHT: true, FULL_DAY: false });
  });

  it("Should include last night spillover at 'to' (23:00 'to' → 05:00 next day)", () => {
    // Scenario:
    // - Multi-day range ending on the 12th; there is a NIGHT booking on the 12th (23:00→05:00 next day).
    // Expectations:
    // - NIGHT is unavailable due to spillover handling through 05:00 after 'to'.
    // - FULL_DAY for the 12th (00:00→24:00) overlaps 23:00–24:00 and is therefore unavailable.
    // - DAY remains available since no 07:00–19:00 overlap exists.
    const bookings = [
      makeBooking({
        id: "b-night-to",
        carId: "carN",
        status: BookingStatus.CONFIRMED,
        startDate: d("2025-10-12T23:00:00.000Z"),
        endDate: d("2025-10-13T05:00:00.000Z"),
        type: BookingType.NIGHT,
      }),
    ];

    const cars = [makeCar({ id: "carN" })];
    const from = d("2025-10-10T10:00:00.000Z");
    const to = d("2025-10-12T10:00:00.000Z");

    const [res] = availabilityByType(cars, bookings, { from, to });
    expect(res.available).toEqual({ DAY: true, NIGHT: false, FULL_DAY: false });
  });

  it("Should align FULL_DAY availability for exact 24h [from..to] with specific request", () => {
    // Scenario:
    // - Exact 24h range from 10:00 on the 10th to 10:00 on the 11th, with a prior-night spillover.
    // Expectations:
    // - In range mode, FULL_DAY is anchored to the exact [from..to] window when the span is 24h,
    //   matching the specific request behavior.
    // - The prior-night 23:00→05:00 does not overlap the 10:00→10:00 FULL_DAY window.
    // - Both availabilityByType and availableCarsForSpecificRequest should agree on availability.
    const bookings = [
      makeBooking({
        id: "b-night-prev",
        carId: "carG",
        status: BookingStatus.CONFIRMED,
        startDate: d("2025-10-09T23:00:00.000Z"),
        endDate: d("2025-10-10T05:00:00.000Z"),
        type: BookingType.NIGHT,
      }),
    ];

    const cars = [makeCar({ id: "carG" })];
    const from = d("2025-10-10T10:00:00.000Z");
    const to = d("2025-10-11T10:00:00.000Z"); // exact 24h window

    // availabilityByType should mark FULL_DAY available
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
    //
    // The test creates:
    // - A FULL_DAY booking from 10:00 Oct 10 to 10:00 Oct 11 (24 hours)
    // - A request for availability from 10:00 Oct 10 to 10:00 Oct 12 (48 hours)
    //
    // The existing booking overlaps with:
    // - DAY bookings on Oct 10 (7:00-19:00)
    // - NIGHT bookings on Oct 10 (23:00-5:00)
    // - FULL_DAY bookings across Oct 10-11
    //
    // Therefore all booking types should be marked as unavailable during this period
    const bookings = [
      makeBooking({
        id: "b-full",
        carId: "carF",
        status: BookingStatus.CONFIRMED,
        startDate: d("2025-10-10T10:00:00.000Z"),
        endDate: d("2025-10-11T10:00:00.000Z"),
        type: BookingType.FULL_DAY,
      }),
    ];

    const cars = [makeCar({ id: "carF" })];
    const from = d("2025-10-10T10:00:00.000Z");
    const to = d("2025-10-12T10:00:00.000Z");

    const [res] = availabilityByType(cars, bookings, { from, to });
    expect(res.available).toEqual({ DAY: false, NIGHT: false, FULL_DAY: false });
  });

  it("Should ignore bookings with statuses outside ACTIVE_STATUSES", () => {
    // Scenario:
    // - A CANCELLED booking exists in the date; only PENDING/CONFIRMED/ACTIVE should affect availability.
    // Expectations:
    // - All types remain available because non-active statuses are ignored in overlap checks.
    const bookings = [
      makeBooking({
        id: "b-cancelled",
        carId: "carZ",
        status: BookingStatus.CANCELLED,
        startDate: d("2025-10-10T07:00:00.000Z"),
        endDate: d("2025-10-10T19:00:00.000Z"),
      }),
    ];

    const cars = [makeCar({ id: "carZ" })];
    const from = d("2025-10-10T10:00:00.000Z");
    const to = d("2025-10-10T10:00:00.000Z");

    const [res] = availabilityByType(cars, bookings, { from, to });
    expect(res.available).toEqual({ DAY: true, NIGHT: true, FULL_DAY: true });
  });

  it("Should treat reversed range (from > to) as all available (no windows)", () => {
    // Scenario:
    // - from is later than to, indicating an invalid or reversed range.
    // Expectations:
    // - No candidate windows are constructed; all types are treated as available.
    const bookings = [
      makeBooking({
        id: "b-day",
        carId: "carR",
        status: BookingStatus.CONFIRMED,
        startDate: d("2025-10-10T07:00:00.000Z"),
        endDate: d("2025-10-10T19:00:00.000Z"),
      }),
    ];

    const cars = [makeCar({ id: "carR" })];
    const from = d("2025-10-12T10:00:00.000Z");
    const to = d("2025-10-11T10:00:00.000Z");

    const [res] = availabilityByType(cars, bookings, { from, to });
    expect(res.available).toEqual({ DAY: true, NIGHT: true, FULL_DAY: true });
  });

  it("Should throw for DAY if start hour is outside 07..11 UTC", () => {
    // Scenario:
    // - DAY requests must be anchored between 07:00 and 11:00 inclusive (UTC).
    // Expectations:
    // - Requests at 06:00 or 12:00 throw validation errors.
    expect(() =>
      buildRequestInterval({ bookingType: BookingType.DAY, from: d("2025-10-10T06:00:00.000Z") }),
    ).toThrowError();
    expect(() =>
      buildRequestInterval({ bookingType: BookingType.DAY, from: d("2025-10-10T12:00:00.000Z") }),
    ).toThrowError();
  });

  it("Should treat adjacent intervals as non-overlapping (e.g., DAY ending 23:00 vs NIGHT starting 23:00)", () => {
    // Scenario:
    // - A DAY window ending at 23:00 and a NIGHT window starting at 23:00 on the same day.
    // Expectations:
    // - Using half-open intervals [start, end), the boundary at 23:00 does not overlap.
    const fromDay = d("2025-10-10T11:00:00.000Z"); // DAY 11→23

    const day = buildRequestInterval({ bookingType: BookingType.DAY, from: fromDay });

    const fromNight = d("2025-10-10T12:00:00.000Z"); // NIGHT 23→05

    // Construct a booking that ends exactly at 23:00
    const bookings = [
      makeBooking({
        id: "b-carX",
        carId: "carX",
        status: BookingStatus.CONFIRMED,
        startDate: day.start,
        endDate: day.end,
      }),
    ];

    // The night request should still be available (no overlap at boundary)
    const ids = availableCarsForSpecificRequest([makeCar({ id: "carX" })], bookings, {
      bookingType: BookingType.NIGHT,
      from: fromNight,
    });
    expect(ids).toEqual(["carX"]);
  });

  it("Should not block 12th daytime or night due to night spillover on 11th (23→05)", () => {
    // Scenario:
    // - A night booking ends at 05:00 on the 12th due to spillover from the 11th.
    // Expectations:
    // - Availability anchored on the 12th should show DAY/NIGHT/FULL_DAY available since the spillover
    //   booking belongs to the 11th→12th night and does not overlap the 12th’s own windows.
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
    expect(flags.available).toEqual({ DAY: true, NIGHT: true, FULL_DAY: true });

    // Specific requests on 12th should all be allowed
    const canDay = availableCarsForSpecificRequest(carsN, bookings, {
      bookingType: BookingType.DAY,
      from: d("2025-10-12T10:00:00.000Z"),
    });
    expect(canDay).toEqual(["carN"]);

    const canNight = availableCarsForSpecificRequest(carsN, bookings, {
      bookingType: BookingType.NIGHT,
      from: d("2025-10-12T12:00:00.000Z"), // anchors NIGHT 23→05 of 12th→13th
    });
    expect(canNight).toEqual(["carN"]);

    const canFull = availableCarsForSpecificRequest(carsN, bookings, {
      bookingType: BookingType.FULL_DAY,
      from: d("2025-10-12T10:00:00.000Z"),
    });
    expect(canFull).toEqual(["carN"]);
  });

  it("Should, on the 11th, allow DAY but block NIGHT and FULL_DAY when there is a night 11th 23→12th 05", () => {
    // Scenario:
    // - A night booking starts at 23:00 on the 11th and ends 05:00 on the 12th.
    // Expectations:
    // - On the 11th, DAY remains available; NIGHT and FULL_DAY are unavailable due to overlap.
    const bookings = [
      makeBooking({
        id: "b-carM",
        carId: "carM",
        status: BookingStatus.CONFIRMED,
        startDate: d("2025-10-11T23:00:00.000Z"),
        endDate: d("2025-10-12T05:00:00.000Z"),
      }),
    ];

    const anchor11th = d("2025-10-11T10:00:00.000Z");
    const carsM = [makeCar({ id: "carM" })];

    const [flags] = availabilityByType(carsM, bookings, { from: anchor11th });
    expect(flags.available).toEqual({ DAY: true, NIGHT: false, FULL_DAY: false });
  });

  it("Should detect exact duplicate intervals as overlapping", () => {
    // Scenario:
    // - A specific request matches an existing booking with identical start and end.
    // Expectations:
    // - The car is not available for that request (overlap detected).
    const start = d("2025-10-10T23:00:00.000Z");
    const end = d("2025-10-11T05:00:00.000Z");
    const carId = "carQ";
    const bookings = [
      makeBooking({
        id: "b-carQ",
        carId,
        status: BookingStatus.CONFIRMED,
        startDate: start,
        endDate: end,
      }),
    ];
    const carsQ = [makeCar({ id: carId })];

    const ids = availableCarsForSpecificRequest(carsQ, bookings, {
      bookingType: BookingType.NIGHT,
      from: start, // NIGHT 10th 23→11th 05 (same as booking)
    });
    expect(ids).toEqual([]);
  });

  it("Should treat night-to-night adjacency across days as non-overlapping (11th 23→12th 05 vs 12th 23→13th 05)", () => {
    // Scenario:
    // - Two NIGHT windows on consecutive days: 11th 23→12th 05 and 12th 23→13th 05.
    // Expectations:
    // - They are on different nights; no overlap, so the car remains available for the second night.
    const carId = "carR";
    const bookings = [
      makeBooking({
        id: "b-carR",
        carId,
        status: BookingStatus.CONFIRMED,
        startDate: d("2025-10-11T23:00:00.000Z"),
        endDate: d("2025-10-12T05:00:00.000Z"),
      }),
    ];
    const carsR = [makeCar({ id: carId })];

    const ids = availableCarsForSpecificRequest(carsR, bookings, {
      bookingType: BookingType.NIGHT,
      from: d("2025-10-12T23:00:00.000Z"), // NIGHT 12th 23→13th 05
    });
    expect(ids).toEqual(["carR"]);
  });
});
