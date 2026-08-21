import { describe, expect, it } from "vitest";

import { searchFlightResponseSchema, tripDurationResponseSchema } from "./schema";

describe("searchFlightResponseSchema", () => {
  it("keeps the fields the booking card needs", () => {
    const parsed = searchFlightResponseSchema.safeParse({
      flight: {
        flightNumber: "DL54",
        flightId: "DL54-20260821",
        origin: "ATL",
        originIATA: "ATL",
        destination: "LOS",
        destinationIATA: "LOS",
        destinationName: "Murtala Muhammed International Airport",
        destinationCity: "Lagos",
        scheduledArrival: "2026-08-21T18:45:00+01:00",
        scheduledDeparture: "2026-08-21T10:00:00-04:00",
        estimatedArrival: "2026-08-21T18:50:00+01:00",
        arrivalTime: "2026-08-21T18:50:00+01:00",
        arrivalTimeSource: "estimated",
      },
      warning: undefined,
      extra: "ignored",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).not.toHaveProperty("extra");
    }
  });
});

describe("tripDurationResponseSchema", () => {
  it("accepts a drive-time estimate", () => {
    expect(
      tripDurationResponseSchema.safeParse({
        durationMinutes: 48,
        distanceMeters: 22_000,
        isEstimate: false,
      }).success,
    ).toBe(true);
  });
});
