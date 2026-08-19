import { describe, expect, it } from "vitest";

import {
  formatCompactPickerDate,
  formatPickerDate,
  formatZonedDate,
  getZonedHour,
  parseZonedCalendarDate,
  startOfZonedDay,
} from "./timezone";

describe("service timezone helpers", () => {
  it("formats a service-timezone calendar date for search URLs", () => {
    expect(formatZonedDate(new Date("2026-08-18T23:00:00.000Z"))).toBe("2026-08-19");
  });

  it("formats a service-timezone calendar date for the picker trigger", () => {
    expect(formatPickerDate(new Date("2026-08-18T23:00:00.000Z"))).toBe("Aug 19");
  });

  it("formats compact search-bar dates without a leading zero", () => {
    expect(formatCompactPickerDate(new Date("2026-08-04T23:00:00.000Z"))).toBe("Aug 5");
  });

  it("reads the service-timezone hour from a UTC instant", () => {
    expect(getZonedHour(new Date("2026-08-18T22:30:00.000Z"))).toBe(23);
  });

  it("returns midnight in the service timezone as a real instant", () => {
    expect(startOfZonedDay(new Date("2026-08-18T23:00:00.000Z")).toISOString()).toBe(
      "2026-08-18T23:00:00.000Z",
    );
  });

  it("parses a yyyy-MM-dd search param as a service-timezone calendar day", () => {
    const parsed = parseZonedCalendarDate("2026-08-19");

    expect(parsed).toBeInstanceOf(Date);
    if (parsed) {
      expect(formatZonedDate(parsed)).toBe("2026-08-19");
    }
    expect(parseZonedCalendarDate("19-08-2026")).toBeUndefined();
  });
});
