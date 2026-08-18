import { describe, expect, it } from "vitest";

import { formatLagosDate, formatPickerDate, getLagosHour, startOfLagosDay } from "./timezone";

describe("Lagos timezone helpers", () => {
  it("formats a Lagos calendar date for search URLs", () => {
    expect(formatLagosDate(new Date("2026-08-18T23:00:00.000Z"))).toBe("2026-08-19");
  });

  it("formats a Lagos calendar date for the picker trigger", () => {
    expect(formatPickerDate(new Date("2026-08-18T23:00:00.000Z"))).toBe("Aug 19");
  });

  it("reads the Lagos hour from a UTC instant", () => {
    expect(getLagosHour(new Date("2026-08-18T22:30:00.000Z"))).toBe(23);
  });

  it("returns midnight in Africa/Lagos as a real instant", () => {
    expect(startOfLagosDay(new Date("2026-08-18T23:00:00.000Z")).toISOString()).toBe(
      "2026-08-18T23:00:00.000Z",
    );
  });
});
