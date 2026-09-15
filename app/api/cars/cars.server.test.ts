import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({
  env: { API_ORIGIN: "https://api.example" },
}));

vi.stubGlobal("fetch", fetchMock);

import { getPublicCar } from "./cars.server";

const car = {
  id: "018f47a2-7b3c-7d4e-8f90-1234567890ab",
  publicRef: "0123456789abcdef",
  make: "Lexus",
  model: "UX F-Sport",
  year: 2019,
  color: "Black",
  dayRate: 100_000,
  nightRate: 80_000,
  fullDayRate: 160_000,
  airportPickupRate: 70_000,
  hourlyRate: 12_000,
  fuelUpgradeRate: 15_000,
  passengerCapacity: 5,
  pricingIncludesFuel: true,
  vehicleType: "SUV",
  serviceTier: "LUXURY",
  images: [{ url: "https://example.com/lexus.jpg" }],
  owner: { username: "fleet-one", name: "Fleet One" },
  promotion: null,
  averageRating: 4.8,
  totalReviews: 12,
};

describe("getPublicCar", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("loads a public car by immutable ref and preserves availability date", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(car));
    const request = new Request("https://tripdly.com/cars/stale--0123456789abcdef");

    const response = await getPublicCar({
      request,
      publicRef: car.publicRef,
      from: "2026-09-01",
    });

    expect(response.data).toEqual(car);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "https://api.example/api/cars/by-ref/0123456789abcdef?from=2026-09-01",
    );
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("GET");
  });

  it("rejects malformed refs before making an API request", () => {
    expect(() =>
      getPublicCar({
        publicRef: "0123456789abcdeF",
      }),
    ).toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
