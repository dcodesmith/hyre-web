import { describe, expect, it } from "vitest";
import {
  calculateRegularBookingTimes,
  resolvePromotionReferenceDate,
} from "./booking-start-datetime.server";

describe("calculateRegularBookingTimes", () => {
  it("accepts valid DAY pickup", () => {
    const r = calculateRegularBookingTimes("9 AM", "DAY", "2026-04-11", "2026-04-13");
    expect("error" in r).toBe(false);
    if ("error" in r) return;
    expect(Number.isNaN(r.startDateTime.getTime())).toBe(false);
  });

  it("returns timezone-stable Lagos instants for DAY bookings", () => {
    const r = calculateRegularBookingTimes("9 AM", "DAY", "2026-04-11", "2026-04-13");
    expect("error" in r).toBe(false);
    if ("error" in r) return;

    // 9:00 AM Lagos = 08:00 UTC
    expect(r.startDateTime.toISOString()).toBe("2026-04-11T08:00:00.000Z");
    // End date anchor is 13th at 9:00 Lagos + 12h = 21:00 Lagos = 20:00 UTC
    expect(r.endDateTime.toISOString()).toBe("2026-04-13T20:00:00.000Z");
  });

  it("returns timezone-stable Lagos instants for NIGHT bookings", () => {
    const r = calculateRegularBookingTimes("11 PM", "NIGHT", "2026-04-11", "2026-04-12");
    expect("error" in r).toBe(false);
    if ("error" in r) return;

    // 11:00 PM Lagos = 22:00 UTC
    expect(r.startDateTime.toISOString()).toBe("2026-04-11T22:00:00.000Z");
    // 5:00 AM Lagos = 04:00 UTC
    expect(r.endDateTime.toISOString()).toBe("2026-04-12T04:00:00.000Z");
  });
});

describe("resolvePromotionReferenceDate", () => {
  it("returns null when trip params are incomplete", () => {
    expect(
      resolvePromotionReferenceDate({
        from: null,
        to: "2026-04-13",
        bookingType: "DAY",
        pickupTime: "9 AM",
      }),
    ).toBeNull();
  });

  it("returns booking start for DAY when pickup is valid", () => {
    const d = resolvePromotionReferenceDate({
      from: "2026-04-11",
      to: "2026-04-13",
      bookingType: "DAY",
      pickupTime: "9 AM",
    });
    expect(d).not.toBeNull();
    if (d) {
      expect(d.getTime()).not.toBeNaN();
    }
  });

  it("defaults night pickup when omitted", () => {
    const d = resolvePromotionReferenceDate({
      from: "2026-04-11",
      to: "2026-04-12",
      bookingType: "NIGHT",
      pickupTime: null,
    });
    expect(d).not.toBeNull();
  });

  it("returns a date for airport pickup using trip calendar day", () => {
    const d = resolvePromotionReferenceDate({
      from: "2026-04-11",
      to: "2026-04-11",
      bookingType: "AIRPORT_PICKUP",
      pickupTime: null,
      flightNumber: "EK782",
    });
    expect(d).not.toBeNull();
  });
});
