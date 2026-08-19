import { describe, expect, it } from "vitest";

import { formatPickerDate, formatZonedDate, getZonedHour, startOfZonedDay } from "./timezone";

describe("service timezone helpers", () => {
  it("formats a service-timezone calendar date for search URLs", () => {
    expect(formatZonedDate(new Date("2026-08-18T23:00:00.000Z"))).toBe("2026-08-19");
  });

  it("formats a service-timezone calendar date for the picker trigger", () => {
    expect(formatPickerDate(new Date("2026-08-18T23:00:00.000Z"))).toBe("Aug 19");
  });

  it("reads the service-timezone hour from a UTC instant", () => {
    expect(getZonedHour(new Date("2026-08-18T22:30:00.000Z"))).toBe(23);
  });

  it("returns midnight in the service timezone as a real instant", () => {
    expect(startOfZonedDay(new Date("2026-08-18T23:00:00.000Z")).toISOString()).toBe(
      "2026-08-18T23:00:00.000Z",
    );
  });
});
