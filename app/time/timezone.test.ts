import { describe, expect, it } from "vitest";

import {
  formatCompactPickerDate,
  formatOutlinePickerDate,
  formatPickerDate,
  formatZonedDate,
  getZonedHour,
  ordinalDay,
  parseZonedCalendarDate,
  startOfZonedDay,
  zonedDateAt,
} from "./timezone";

describe("service timezone helpers", () => {
  it("formats a service-timezone calendar date for search URLs", () => {
    expect(formatZonedDate(new Date("2026-08-18T23:00:00.000Z"))).toBe("2026-08-19");
  });

  it("formats a service-timezone calendar date for the picker trigger", () => {
    expect(formatPickerDate(new Date("2026-08-18T23:00:00.000Z"))).toBe("Aug 19");
  });

  it("formats a service-timezone calendar date for the outlined picker trigger", () => {
    expect(formatOutlinePickerDate(new Date("2026-08-18T23:00:00.000Z"))).toBe("Aug 19, 2026");
  });

  it("formats compact search-bar dates without a leading zero", () => {
    expect(formatCompactPickerDate(new Date("2026-08-04T23:00:00.000Z"))).toBe("Aug 5");
  });

  it("formats English ordinals for calendar-day copy", () => {
    expect(ordinalDay(1)).toBe("1st");
    expect(ordinalDay(2)).toBe("2nd");
    expect(ordinalDay(3)).toBe("3rd");
    expect(ordinalDay(11)).toBe("11th");
    expect(ordinalDay(21)).toBe("21st");
    expect(ordinalDay(22)).toBe("22nd");
  });

  it("reads the service-timezone hour from a UTC instant", () => {
    expect(getZonedHour(new Date("2026-08-18T22:30:00.000Z"))).toBe(23);
  });

  it("returns midnight in the service timezone as a real instant", () => {
    expect(startOfZonedDay(new Date("2026-08-18T23:00:00.000Z")).toISOString()).toBe(
      "2026-08-18T23:00:00.000Z",
    );
  });

  it("builds a clock time on a service-timezone calendar day", () => {
    expect(zonedDateAt("2026-09-01", 9)?.toISOString()).toBe("2026-09-01T08:00:00.000Z");
    expect(zonedDateAt("2026-09-01", 21)?.toISOString()).toBe("2026-09-01T20:00:00.000Z");
  });

  it("parses a yyyy-MM-dd search param as a service-timezone calendar day", () => {
    const parsed = parseZonedCalendarDate("2026-08-19");

    expect(parsed).toBeInstanceOf(Date);
    if (parsed) {
      expect(formatZonedDate(parsed)).toBe("2026-08-19");
    }
    expect(parseZonedCalendarDate("19-08-2026")).toBeUndefined();
    expect(parseZonedCalendarDate("2026-13-45")).toBeUndefined();
    expect(parseZonedCalendarDate("2026-02-31")).toBeUndefined();
    expect(parseZonedCalendarDate("2023-02-29")).toBeUndefined();
    expect(parseZonedCalendarDate("2024-02-29")).toBeInstanceOf(Date);
  });
});
