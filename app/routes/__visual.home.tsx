import type { CarCategoriesResponse } from "~/api/cars/schema";
import { HomePage } from "~/home/home-page";

// Relative to each run so "New" badges do not disappear after a fixed createdAt ages out.
const recentListingCreatedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

const fixtureCars: CarCategoriesResponse["allCars"] = [
  {
    id: "cmfixturetoyotacamry001",
    make: "Toyota",
    model: "Camry",
    year: 2023,
    dayRate: 75_000,
    passengerCapacity: 4,
    pricingIncludesFuel: true,
    vehicleType: "SEDAN",
    serviceTier: "EXECUTIVE",
    images: [{ url: "/images/hero-640.webp" }],
    createdAt: recentListingCreatedAt,
    promotion: null,
    averageRating: 4.8,
    totalReviews: 24,
  },
  {
    id: "cmfixturelexusrx350002",
    make: "Lexus",
    model: "RX 350",
    year: 2022,
    dayRate: 120_000,
    passengerCapacity: 5,
    pricingIncludesFuel: false,
    vehicleType: "SUV",
    serviceTier: "LUXURY",
    images: [{ url: "/images/hero-1200.webp" }],
    createdAt: recentListingCreatedAt,
    promotion: {
      id: "promo-fixture",
      name: "August offer",
      discountValue: 10,
    },
    averageRating: 4.9,
    totalReviews: 18,
  },
  {
    id: "cmfixturehighlander003",
    make: "Toyota",
    model: "Highlander",
    year: 2021,
    dayRate: 95_000,
    passengerCapacity: 6,
    pricingIncludesFuel: true,
    vehicleType: "SUV",
    serviceTier: "STANDARD",
    images: [{ url: "/images/hero.webp" }],
    createdAt: "2026-01-01T09:00:00.000Z",
    promotion: null,
    averageRating: 0,
    totalReviews: 0,
  },
];

const fixtureFleet = {
  categories: [
    {
      name: "popular",
      title: "Popular",
      type: "make",
      cars: [...fixtureCars],
    },
  ],
  allCars: [...fixtureCars],
  total: fixtureCars.length,
} satisfies CarCategoriesResponse;

export default function HomeFixture() {
  return <HomePage fleet={fixtureFleet} />;
}
