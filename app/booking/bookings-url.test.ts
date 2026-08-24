import { describe, expect, it } from "vitest";

import { bookingListPath, bookingListStatusLabel, parseBookingListStatus } from "./bookings-url";

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
