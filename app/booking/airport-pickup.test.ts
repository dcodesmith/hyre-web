import { describe, expect, it } from "vitest";

import {
  buildTripDetails,
  composeAirportPickupAddress,
  formatBufferedDrive,
  formatDistanceText,
  formatFlightArrivalSummary,
  formatFlightRoute,
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

  it("formats arrival and trip-detail copy", () => {
    expect(formatFlightRoute(flight)).toBe("ATL → LOS");
    expect(formatFlightArrivalSummary(flight)).toBe("ATL → LOS • 6:45 PM");
    expect(formatBufferedDrive(48)).toBe("48 mins");
    expect(formatBufferedDrive(60)).toBe("1 hour");
    expect(formatBufferedDrive(90)).toBe("1 hour 30 mins");
    expect(formatDistanceText(22_000)).toBe("22.0 km");
    expect(formatDistanceText(0)).toBe("Distance unavailable");
    expect(
      buildTripDetails(flight.arrivalTime, {
        durationMinutes: 48,
        distanceMeters: 22_000,
        isEstimate: false,
      }),
    ).toEqual({
      arrivalTime: "6:45 PM",
      pickupTime: "7:25 PM",
      driveText: "58 mins",
      distanceText: "22.0 km",
      dropOffTime: "8:23 PM",
      isEstimate: false,
    });
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
