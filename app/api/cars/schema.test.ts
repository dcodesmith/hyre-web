import { describe, expect, it } from "vitest";

import { carSearchResponseSchema } from "./schema";

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
