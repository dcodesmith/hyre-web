import { describe, expect, it } from "vitest";

import { carSearchResponseSchema, publicCarDetailSchema } from "./schema";

describe("carSearchResponseSchema", () => {
  it("accepts a live search car whose owner name is null", () => {
    const parsed = carSearchResponseSchema.safeParse({
      cars: [
        {
          id: "cmk2ibkw7000wl404f5cg3fot",
          make: "Honda",
          model: "Accord LX",
          year: 2024,
          color: "White",
          dayRate: 1000,
          nightRate: 5000,
          fullDayRate: 2000,
          airportPickupRate: 700,
          passengerCapacity: 4,
          pricingIncludesFuel: false,
          vehicleType: "SEDAN",
          serviceTier: "STANDARD",
          images: [{ url: "https://example.com/accord.jpg" }],
          owner: { username: "creamy", name: null },
          promotion: null,
          averageRating: 0,
          totalReviews: 0,
        },
      ],
      filters: { serviceTiers: [], vehicleTypes: [], bookingType: null },
      facets: { makes: [{ name: "Honda", count: 1 }], price: { min: 250, max: 1900 } },
      pagination: {
        page: 1,
        limit: 1,
        total: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    });

    expect(parsed.success).toBe(true);
  });
});

describe("publicCarDetailSchema", () => {
  const detailCar = {
    id: "cmmz4f7x00000l804jj2d6ikn",
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
    owner: { username: "fleet-one", name: null },
    promotion: null,
    averageRating: 4.8,
    totalReviews: 12,
  };

  it("accepts extra booking rates and optional listing time", () => {
    expect(publicCarDetailSchema.safeParse(detailCar).success).toBe(true);
    expect(
      publicCarDetailSchema.safeParse({
        ...detailCar,
        createdAt: "2026-08-12T12:00:00.000Z",
      }).success,
    ).toBe(true);
  });
});
