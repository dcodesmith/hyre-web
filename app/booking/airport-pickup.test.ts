import { describe, expect, it } from "vitest";

import {
  composeAirportPickupAddress,
  formatFlightArrivalSummary,
  formatTripDuration,
  isCompleteFlightNumber,
  nightBookingHelperText,
  normalizeFlightNumber,
} from "~/booking/airport-pickup";

const flight = {
  flightNumber: "DL54",
  flightId: "DL54-20260821",
  origin: "Atlanta",
  originIATA: "ATL",
  destination: "Lagos",
  destinationIATA: "LOS",
  destinationName: "Murtala Muhammed International Airport",
  destinationCity: "Lagos",
  scheduledArrival: "2026-08-21T18:45:00+01:00",
  scheduledDeparture: "2026-08-21T10:00:00-04:00",
  arrivalTime: "2026-08-21T18:45:00+01:00",
  arrivalTimeSource: "scheduled" as const,
};

describe("airport pickup helpers", () => {
  it("normalizes and recognizes complete flight numbers", () => {
    expect(normalizeFlightNumber(" ba 74 ")).toBe("BA74");
    expect(isCompleteFlightNumber("BA74")).toBe(true);
    expect(isCompleteFlightNumber("BA")).toBe(false);
    expect(isCompleteFlightNumber("123")).toBe(false);
  });

  it("composes the airport pickup address from flight fields", () => {
    expect(composeAirportPickupAddress(flight)).toBe(
      "Murtala Muhammed International Airport, Lagos",
    );
    expect(
      composeAirportPickupAddress({
        ...flight,
        destinationName: undefined,
        destinationCity: undefined,
        destinationIATA: undefined,
      }),
    ).toBe("Lagos");
  });

  it("formats arrival and drive-time copy", () => {
    expect(formatFlightArrivalSummary(flight)).toMatch(/^ATL → LOS • /);
    expect(formatTripDuration({ durationMinutes: 48.2, distanceMeters: 1, isEstimate: true })).toBe(
      "About 48 min from the airport (estimate)",
    );
  });

  it("builds night helper copy only for overnight bookings", () => {
    expect(nightBookingHelperText("DAY", 2)).toBeNull();
    expect(nightBookingHelperText("NIGHT", 0)).toBeNull();
    expect(nightBookingHelperText("NIGHT", 1)).toBe(
      "All overnight bookings start at 11pm and end at 5am. Booking for 1 night.",
    );
    expect(nightBookingHelperText("NIGHT", 2)).toBe(
      "All overnight bookings start at 11pm and end at 5am. Booking for 2 nights.",
    );
  });
});
