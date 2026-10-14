import { describe, expect, it } from "vitest";

import {
  bookingListPath,
  bookingListStatusLabel,
  formatBookingListDateRange,
  formatBookingListTime,
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

describe("formatBookingListDateRange", () => {
  it("formats a Lagos date range without repeating the month or year", () => {
    expect(formatBookingListDateRange("2026-08-21T08:00:00.000Z", "2026-08-21T20:00:00.000Z")).toBe(
      "Aug 21",
    );
    expect(formatBookingListDateRange("2026-10-09T10:00:00.000Z", "2026-10-10T10:00:00.000Z")).toBe(
      "Oct 9 - 10",
    );
    expect(formatBookingListDateRange("2026-08-31T20:00:00.000Z", "2026-09-01T08:00:00.000Z")).toBe(
      "Aug 31 - Sep 1",
    );
    expect(formatBookingListDateRange("2026-12-31T20:00:00.000Z", "2027-01-01T08:00:00.000Z")).toBe(
      "Dec 31, 2026 - Jan 1, 2027",
    );
  });

  it("returns the original start value when a date is invalid", () => {
    expect(formatBookingListDateRange("not-a-date", "2026-08-21T08:00:00.000Z")).toBe("not-a-date");
  });
});

describe("formatBookingListTime", () => {
  it("formats the Lagos pickup time", () => {
    expect(formatBookingListTime("2026-08-21T08:00:00.000Z")).toBe("9:00 AM");
    expect(formatBookingListTime("2026-08-21T23:30:00.000Z")).toBe("12:30 AM");
  });

  it("returns the original value when the date is invalid", () => {
    expect(formatBookingListTime("not-a-date")).toBe("not-a-date");
  });
});
