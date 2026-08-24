import { describe, expect, it } from "vitest";

import { formatBookingListDateTime } from "./bookings-list";

describe("formatBookingListDateTime", () => {
  it("matches hireApp PPPp in Africa/Lagos", () => {
    expect(formatBookingListDateTime("2026-08-21T08:00:00.000Z")).toBe(
      "August 21st, 2026 at 9:00 AM",
    );
    expect(formatBookingListDateTime("2026-08-21T23:30:00.000Z")).toBe(
      "August 22nd, 2026 at 12:30 AM",
    );
  });

  it("returns the original value when the date is invalid", () => {
    expect(formatBookingListDateTime("not-a-date")).toBe("not-a-date");
  });
});
