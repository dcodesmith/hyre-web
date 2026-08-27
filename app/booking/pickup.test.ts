import { describe, expect, it } from "vitest";

import {
  getPickupTimes,
  nextPickupTimeOnFromChange,
  normalizePickupTime,
  parsePickupClock,
} from "~/booking/pickup";

describe("booking pickup times", () => {
  it("keeps pickup time only when it is still offered for the new From date", () => {
    const morning = new Date("2026-08-18T09:30:00+01:00");
    const today = new Date("2026-08-18T00:00:00+01:00");
    const tomorrow = new Date("2026-08-19T00:00:00+01:00");

    expect(
      nextPickupTimeOnFromChange({
        bookingType: "DAY",
        fromDate: today,
        currentPickupTime: "9 AM",
        fallbackDate: today,
        now: morning,
      }),
    ).toBeUndefined();
    expect(
      nextPickupTimeOnFromChange({
        bookingType: "DAY",
        fromDate: today,
        currentPickupTime: "11 AM",
        fallbackDate: today,
        now: morning,
      }),
    ).toBe("11 AM");
    expect(
      nextPickupTimeOnFromChange({
        bookingType: "DAY",
        fromDate: tomorrow,
        currentPickupTime: "9 AM",
        fallbackDate: today,
        now: morning,
      }),
    ).toBe("9 AM");
    expect(
      nextPickupTimeOnFromChange({
        bookingType: "DAY",
        fromDate: undefined,
        currentPickupTime: "9 AM",
        fallbackDate: today,
        now: morning,
      }),
    ).toBeUndefined();
  });

  it("parses hourly pickup labels to a 24-hour clock", () => {
    expect(parsePickupClock("7 AM")).toEqual({ hour: 7, minute: 0 });
    expect(parsePickupClock("11 AM")).toEqual({ hour: 11, minute: 0 });
    expect(parsePickupClock("11 PM")).toEqual({ hour: 23, minute: 0 });
    expect(parsePickupClock("")).toBeUndefined();
  });

  it("normalizes hourly times and leaves non-hourly minutes unchanged", () => {
    expect(normalizePickupTime("9 AM")).toBe("9 AM");
    expect(normalizePickupTime("9:00 am")).toBe("9 AM");
    expect(normalizePickupTime("9:30 AM")).toBe("9:30 AM");
    expect(normalizePickupTime("9:99 AM")).toBe("9:99 AM");
  });

  it("drops a non-hourly pickup time when the From date changes", () => {
    const morning = new Date("2026-08-18T09:30:00+01:00");
    const tomorrow = new Date("2026-08-19T00:00:00+01:00");

    expect(
      nextPickupTimeOnFromChange({
        bookingType: "DAY",
        fromDate: tomorrow,
        currentPickupTime: "9:30 AM",
        fallbackDate: tomorrow,
        now: morning,
      }),
    ).toBeUndefined();
  });

  it("offers only 11 PM for night bookings and keeps it across From changes", () => {
    const morning = new Date("2026-08-18T09:30:00+01:00");
    const today = new Date("2026-08-18T00:00:00+01:00");
    const tomorrow = new Date("2026-08-19T00:00:00+01:00");

    expect(getPickupTimes(tomorrow, "NIGHT", morning)).toEqual([
      { label: "11 PM", value: "11 PM" },
    ]);
    expect(
      nextPickupTimeOnFromChange({
        bookingType: "NIGHT",
        fromDate: tomorrow,
        currentPickupTime: "11 PM",
        fallbackDate: today,
        now: morning,
      }),
    ).toBe("11 PM");
  });
});
