import type { CarSearchResponse } from "~/api/cars/schema";
import { SearchPage } from "~/search/search-page";

const recentListingCreatedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

const fixtureResult = {
  cars: [
    {
      id: "cmfixturetoyotacamry001",
      make: "Toyota",
      model: "Camry",
      year: 2023,
      color: "White",
      dayRate: 75_000,
      nightRate: 90_000,
      fullDayRate: 140_000,
      airportPickupRate: 55_000,
      passengerCapacity: 4,
      pricingIncludesFuel: true,
      vehicleType: "SEDAN",
      serviceTier: "EXECUTIVE",
      images: [{ url: "/images/hero-640.webp" }],
      createdAt: recentListingCreatedAt,
      owner: { username: "fleet-one", name: "Fleet One" },
      promotion: null,
      averageRating: 4.8,
      totalReviews: 24,
    },
    {
      id: "cmfixturelexusrx350002",
      make: "Lexus",
      model: "RX 350",
      year: 2022,
      color: "Black",
      dayRate: 120_000,
      nightRate: 150_000,
      fullDayRate: 220_000,
      airportPickupRate: 80_000,
      passengerCapacity: 5,
      pricingIncludesFuel: false,
      vehicleType: "SUV",
      serviceTier: "LUXURY",
      images: [{ url: "/images/hero-1200.webp" }],
      createdAt: recentListingCreatedAt,
      owner: { username: "fleet-two", name: "Fleet Two" },
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
      color: "Silver",
      dayRate: 95_000,
      nightRate: 110_000,
      fullDayRate: 180_000,
      airportPickupRate: 70_000,
      passengerCapacity: 6,
      pricingIncludesFuel: true,
      vehicleType: "SUV",
      serviceTier: "STANDARD",
      images: [{ url: "/images/hero.webp" }],
      createdAt: "2026-01-01T09:00:00.000Z",
      owner: { username: null, name: "Fleet Three" },
      promotion: null,
      averageRating: 0,
      totalReviews: 0,
    },
  ],
  filters: {
    serviceTiers: [],
    vehicleTypes: [],
    bookingType: "DAY",
  },
  facets: {
    makes: [
      { name: "Toyota", count: 2 },
      { name: "Lexus", count: 1 },
    ],
    price: { min: 55_000, max: 220_000 },
  },
  pagination: {
    page: 1,
    limit: 12,
    total: 3,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  },
} satisfies CarSearchResponse;

export default function SearchFixture() {
  return <SearchPage result={fixtureResult} />;
}
