import { describe, expect, it } from "vitest";

import {
  getEarliestBookableDate,
  getToDateMinDate,
  isLagosCutoffTomorrow,
  isValidToDateSelection,
  nextPickupTimeOnFromChange,
  nextToDateOnFromChange,
} from "./booking-utils";
import { formatLagosDate } from "./timezone";

describe("booking date rules", () => {
  it("blocks same-day To dates for night and full-day bookings", () => {
    const from = new Date("2026-08-18T10:00:00+01:00");

    expect(isValidToDateSelection("NIGHT", from, from)).toBe(false);
    expect(isValidToDateSelection("FULL_DAY", from, from)).toBe(false);
    expect(isValidToDateSelection("DAY", from, from)).toBe(true);
  });

  it("requires the next Lagos day as the To minimum for overnight bookings", () => {
    const from = new Date("2026-08-18T10:00:00+01:00");
    const minTo = getToDateMinDate("NIGHT", from);

    expect(minTo).toBeDefined();
    expect(formatLagosDate(minTo as Date)).toBe("2026-08-19");
    expect(getToDateMinDate("DAY", from)).toEqual(from);
    expect(getToDateMinDate("DAY", undefined)).toBeUndefined();
  });

  it("uses the Lagos calendar day, not the runtime local date", () => {
    const afterUtcMidnightBeforeLagosCutoff = new Date("2026-08-18T23:30:00.000Z");

    expect(
      formatLagosDate(
        getEarliestBookableDate({
          bookingType: "DAY",
          now: afterUtcMidnightBeforeLagosCutoff,
        }),
      ),
    ).toBe("2026-08-19");
  });

  it("pushes Same Day bookings to tomorrow after the Lagos 11:00 cutoff", () => {
    const afterDayCutoff = new Date("2026-08-19T10:30:00.000Z");

    expect(
      formatLagosDate(
        getEarliestBookableDate({
          bookingType: "DAY",
          now: afterDayCutoff,
        }),
      ),
    ).toBe("2026-08-20");
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

  it("matches the hireApp Lagos booking cutoff", () => {
    expect(isLagosCutoffTomorrow("DAY", 11)).toBe(true);
    expect(isLagosCutoffTomorrow("DAY", 10)).toBe(false);
    expect(isLagosCutoffTomorrow("NIGHT", 23)).toBe(true);
    expect(isLagosCutoffTomorrow("AIRPORT_PICKUP", 23)).toBe(false);
    expect(isLagosCutoffTomorrow("FULL_DAY", 23)).toBe(false);
  });
});
