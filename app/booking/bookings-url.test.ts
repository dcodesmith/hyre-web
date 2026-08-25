import { describe, expect, it } from "vitest";

import {
  bookingListPath,
  bookingListStatusLabel,
  formatBookingListDateTime,
  parseBookingListStatus,
} from "./bookings-url";

describe("parseBookingListStatus", () => {
  it("defaults to ACTIVE and accepts the hireApp tab names", () => {
    expect(parseBookingListStatus(new URLSearchParams())).toBe("ACTIVE");
    expect(parseBookingListStatus(new URLSearchParams("status=active"))).toBe("ACTIVE");
    expect(parseBookingListStatus(new URLSearchParams("status=COMPLETED"))).toBe("COMPLETED");
    expect(parseBookingListStatus(new URLSearchParams("status=nope"))).toBe("ACTIVE");
  });
});

describe("bookingListPath", () => {
  it("writes the lowercase status query hireApp uses", () => {
    expect(bookingListPath("ACTIVE")).toBe("/bookings?status=active");
    expect(bookingListPath("CANCELLED")).toBe("/bookings?status=cancelled");
    expect(bookingListStatusLabel("CONFIRMED")).toBe("Confirmed");
  });
});

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
