import { describe, expect, it } from "vitest";

import { bookingTypeChangeOverrides } from "~/car/use-car-booking-card";

describe("bookingTypeChangeOverrides", () => {
  it("keeps pickup and drop-off addresses when switching DAY to NIGHT", () => {
    expect(bookingTypeChangeOverrides("DAY", "NIGHT")).toEqual({
      from: null,
      to: null,
      pickupTime: null,
      flightNumber: null,
      pickupAddress: undefined,
      dropOffAddress: undefined,
      sameLocation: true,
    });
  });

  it("clears location fields when entering or leaving airport pickup", () => {
    expect(bookingTypeChangeOverrides("DAY", "AIRPORT_PICKUP").pickupAddress).toBeNull();
    expect(bookingTypeChangeOverrides("DAY", "AIRPORT_PICKUP").dropOffAddress).toBeNull();
    expect(bookingTypeChangeOverrides("AIRPORT_PICKUP", "DAY").pickupAddress).toBeNull();
    expect(bookingTypeChangeOverrides("AIRPORT_PICKUP", "DAY").dropOffAddress).toBeNull();
  });
});
