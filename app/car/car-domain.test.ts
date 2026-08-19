import { describe, expect, it } from "vitest";

import type { PublicCar } from "~/api/cars/schema";
import { CarDomain } from "~/car/car-domain";

function car(overrides: Partial<PublicCar> = {}): PublicCar {
  return {
    id: "cmmz4f7x00000l804jj2d6ikn",
    make: "Lexus",
    model: "UX F-Sport",
    year: 2019,
    dayRate: 100_000,
    passengerCapacity: 5,
    pricingIncludesFuel: true,
    vehicleType: "SUV",
    serviceTier: "LUXURY",
    images: [{ url: "/images/hero-640.webp" }],
    createdAt: "2026-08-12T12:00:00.000Z",
    promotion: null,
    averageRating: 4.6,
    totalReviews: 12,
    ...overrides,
  };
}

describe("CarDomain", () => {
  const now = new Date("2026-08-18T12:00:00.000Z");

  it("assembles name, href, and image from the public car DTO", () => {
    const view = CarDomain(car(), now);

    expect(view.name).toBe("Lexus UX F-Sport (2019)");
    expect(view.href).toBe("/cars/2019-lexus-ux-f-sport-cmmz4f7x00000?bookingType=DAY");
    expect(view.imageUrl).toBe("/images/hero-640.webp");
  });

  it("shows a sale price and badge when a positive promotion is present", () => {
    const view = CarDomain(
      car({
        promotion: { id: "promo-1", name: "Weekend", discountValue: 12.5 },
      }),
      now,
    );

    expect(view.hasPromotion).toBe(true);
    expect(view.promotionLabel).toBe("12.5% OFF");
    expect(view.displayRate).toBe(87_500);
    expect(view.showPromoPrice).toBe(true);
    expect(view.listRateLabel).toBe("₦100,000");
    expect(view.displayRateLabel).toBe("₦87,500");
  });

  it("ignores a zero-discount promotion", () => {
    const view = CarDomain(
      car({
        promotion: { id: "promo-1", name: null, discountValue: 0 },
      }),
      now,
    );

    expect(view.hasPromotion).toBe(false);
    expect(view.promotionLabel).toBeNull();
    expect(view.displayRate).toBe(100_000);
    expect(view.showPromoPrice).toBe(false);
  });

  it("marks listings newer than seven days as new and rejects future dates", () => {
    expect(CarDomain(car({ createdAt: undefined }), now).isNew).toBe(false);
    expect(CarDomain(car({ createdAt: "not-a-date" }), now).isNew).toBe(false);
    expect(CarDomain(car({ createdAt: "2026-08-12T12:00:00.000Z" }), now).isNew).toBe(true);
    expect(CarDomain(car({ createdAt: "2026-08-11T12:00:00.000Z" }), now).isNew).toBe(false);
    expect(CarDomain(car({ createdAt: "2026-08-19T12:00:00.000Z" }), now).isNew).toBe(false);
  });

  it("shows a clamped rating only when reviews exist", () => {
    const withReviews = CarDomain(car({ averageRating: 6.2, totalReviews: 3 }), now);
    expect(withReviews.showRating).toBe(true);
    expect(withReviews.displayRating).toBe(5);
    expect(withReviews.ratingLabel).toBe("Average rating: 5.0 out of 5 stars");

    const withoutReviews = CarDomain(car({ averageRating: 4.2, totalReviews: 0 }), now);
    expect(withoutReviews.showRating).toBe(false);
  });

  it("can be new, on sale, and reviewed at the same time", () => {
    const view = CarDomain(
      car({
        createdAt: "2026-08-16T12:00:00.000Z",
        promotion: { id: "promo-1", name: "Launch", discountValue: 20 },
        averageRating: 4.8,
        totalReviews: 7,
      }),
      now,
    );

    expect(view.isNew).toBe(true);
    expect(view.hasPromotion).toBe(true);
    expect(view.promotionLabel).toBe("20% OFF");
    expect(view.showRating).toBe(true);
    expect(view.displayRating).toBe(4.8);
    expect(view.displayRate).toBe(80_000);
  });
});
