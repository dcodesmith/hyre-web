import { describe, expect, it } from "vitest";

import {
  calculateBookingUnits,
  getEarliestBookableDate,
  getToDateMinDate,
  hasCompleteBookingDates,
  isSameDayCutoffTomorrow,
  isValidToDateSelection,
  nextToDateOnFromChange,
} from "~/booking/dates";
import { formatZonedDate } from "~/time/timezone";

describe("booking date rules", () => {
  it("blocks same-day To dates for night and full-day bookings", () => {
    const from = new Date("2026-08-18T10:00:00+01:00");

    expect(isValidToDateSelection("NIGHT", from, from)).toBe(false);
    expect(isValidToDateSelection("FULL_DAY", from, from)).toBe(false);
    expect(isValidToDateSelection("DAY", from, from)).toBe(true);
  });

  it("requires the next service-timezone day as the To minimum for overnight bookings", () => {
    const from = new Date("2026-08-18T10:00:00+01:00");
    const minTo = getToDateMinDate("NIGHT", from);

    expect(minTo).toBeInstanceOf(Date);
    if (minTo) {
      expect(formatZonedDate(minTo)).toBe("2026-08-19");
    }
    expect(getToDateMinDate("DAY", from)).toEqual(from);
    expect(getToDateMinDate("DAY", undefined)).toBeUndefined();
  });

  it("uses the service-timezone calendar day, not the runtime local date", () => {
    const afterUtcMidnightBeforeCutoff = new Date("2026-08-18T23:30:00.000Z");

    expect(
      formatZonedDate(
        getEarliestBookableDate({
          bookingType: "DAY",
          now: afterUtcMidnightBeforeCutoff,
        }),
      ),
    ).toBe("2026-08-19");
  });

  it("pushes Same Day bookings to tomorrow after the 11:00 cutoff", () => {
    const afterDayCutoff = new Date("2026-08-19T10:30:00.000Z");

    expect(
      formatZonedDate(
        getEarliestBookableDate({
          bookingType: "DAY",
          now: afterDayCutoff,
        }),
      ),
    ).toBe("2026-08-20");
  });

  it("treats airport pickup as complete when only From is set", () => {
    const from = new Date("2026-08-18T10:00:00+01:00");

    expect(hasCompleteBookingDates("AIRPORT_PICKUP", from, undefined)).toBe(true);
    expect(hasCompleteBookingDates("DAY", from, undefined)).toBe(false);
    expect(hasCompleteBookingDates("DAY", from, from)).toBe(true);
    expect(hasCompleteBookingDates("AIRPORT_PICKUP", undefined, undefined)).toBe(false);
  });

  it("clears To when From is cleared or moves past To", () => {
    const from = new Date(2026, 7, 20);
    const to = new Date(2026, 7, 19);

    expect(nextToDateOnFromChange("DAY", undefined, to)).toBeUndefined();
    expect(nextToDateOnFromChange("DAY", from, to)).toBeUndefined();
    expect(nextToDateOnFromChange("AIRPORT_PICKUP", undefined, to)).toBeUndefined();
    expect(nextToDateOnFromChange("AIRPORT_PICKUP", from, to)).toEqual(from);
    expect(nextToDateOnFromChange("DAY", from, new Date(2026, 7, 22))).toEqual(
      new Date(2026, 7, 22),
    );
  });

  it("clears a same-day To when From changes on overnight bookings", () => {
    const from = new Date("2026-08-18T10:00:00+01:00");

    expect(nextToDateOnFromChange("NIGHT", from, from)).toBeUndefined();
    expect(nextToDateOnFromChange("FULL_DAY", from, from)).toBeUndefined();
    expect(nextToDateOnFromChange("DAY", from, from)).toEqual(from);
  });

  it("matches the hireApp same-day booking cutoff", () => {
    expect(isSameDayCutoffTomorrow("DAY", 11)).toBe(true);
    expect(isSameDayCutoffTomorrow("DAY", 10)).toBe(false);
    expect(isSameDayCutoffTomorrow("NIGHT", 23)).toBe(true);
    expect(isSameDayCutoffTomorrow("AIRPORT_PICKUP", 23)).toBe(false);
    expect(isSameDayCutoffTomorrow("FULL_DAY", 23)).toBe(false);
  });

  it("counts booking units the same way hireApp prices a date range", () => {
    expect(calculateBookingUnits("2026-10-26", "2026-10-26", "DAY")).toBe(1);
    expect(calculateBookingUnits("2026-10-26", "2026-10-27", "DAY")).toBe(2);
    expect(calculateBookingUnits("2026-10-26", "2026-10-27", "NIGHT")).toBe(1);
    expect(calculateBookingUnits("2026-10-26", "2026-10-28", "FULL_DAY")).toBe(2);
    expect(calculateBookingUnits("2026-10-26", "2026-10-28", "AIRPORT_PICKUP")).toBe(1);
    expect(calculateBookingUnits(undefined, "2026-10-28", "DAY")).toBe(1);
  });
});
