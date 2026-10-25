import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiRequestError } from "~/api/api.server";
import { HTTP_STATUS } from "~/api/http-status";

const { calculateAirportTripDuration } = vi.hoisted(() => ({
  calculateAirportTripDuration: vi.fn(),
}));

vi.mock("~/api/flights/flights.server", () => ({ calculateAirportTripDuration }));

import { loader } from "./api.calculate-trip-duration";

const duration = {
  durationMinutes: 34,
  distanceMeters: 12_800,
  isEstimate: true,
};

describe("trip duration resource", () => {
  beforeEach(() => {
    calculateAirportTripDuration.mockReset();
  });

  it("returns the drive estimate for a destination", async () => {
    calculateAirportTripDuration.mockResolvedValue({ data: duration });
    const request = new Request(
      "https://tripdly.com/api/calculate-trip-duration?destination=Victoria+Island",
    );

    const result = await loader({ request, params: {}, context: {} } as never);

    expect(calculateAirportTripDuration).toHaveBeenCalledWith({
      request,
      destination: "Victoria Island",
    });
    expect(result).toMatchObject({ data: { duration, error: null } });
  });

  it("keeps an unavailable estimate on the resource instead of failing the page", async () => {
    calculateAirportTripDuration.mockRejectedValue(
      new ApiRequestError("network", HTTP_STATUS.SERVICE_UNAVAILABLE, {
        type: "UPSTREAM_UNAVAILABLE",
        title: "Upstream API unavailable",
        status: HTTP_STATUS.SERVICE_UNAVAILABLE,
        detail: "The upstream API response could not be completed.",
      }),
    );
    const request = new Request(
      "https://tripdly.com/api/calculate-trip-duration?destination=Victoria+Island",
    );

    const result = await loader({ request, params: {}, context: {} } as never);

    expect(result).toMatchObject({
      init: { status: HTTP_STATUS.SERVICE_UNAVAILABLE },
      data: { duration: null, error: "Unable to estimate the drive. Please try again." },
    });
  });
});
