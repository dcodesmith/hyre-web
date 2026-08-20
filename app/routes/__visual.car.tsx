import type { PublicCarDetail } from "~/api/cars/schema";
import type { CarReviewsResponse } from "~/api/reviews/schema";
import { CarDetailPage } from "~/car/car-detail-page";

const recentListingCreatedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

const fixtureCar = {
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
  images: [{ url: "/images/hero-640.webp" }, { url: "/images/hero-1200.webp" }],
  createdAt: recentListingCreatedAt,
  owner: { username: "fleet-one", name: "Fleet One" },
  promotion: {
    id: "promo-fixture",
    name: "August offer",
    discountValue: 10,
  },
  averageRating: 4.8,
  totalReviews: 12,
} satisfies PublicCarDetail;

const fixtureReviews = {
  reviews: [
    {
      id: "cmreviewfixture0000000001",
      overallRating: 5,
      carRating: 5,
      chauffeurRating: 5,
      serviceRating: 5,
      comment: "Smooth airport pickup and a spotless cabin.",
      createdAt: "2026-08-10T09:00:00.000Z",
      user: { id: "cmuserfixture000000000001", name: "Ada Lovelace", image: null },
    },
    {
      id: "cmreviewfixture0000000002",
      overallRating: 4,
      carRating: 4,
      chauffeurRating: 5,
      serviceRating: 4,
      comment: "Great for a day of meetings across Lagos.",
      createdAt: "2026-07-22T14:30:00.000Z",
      user: { id: "cmuserfixture000000000002", name: "Bola Ahmed", image: null },
    },
  ],
  pagination: {
    page: 1,
    limit: 12,
    total: 12,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  },
  ratings: {
    averageRating: 4.8,
    totalReviews: 12,
    ratingDistribution: { 1: 0, 2: 0, 3: 1, 4: 3, 5: 8 },
  },
} satisfies CarReviewsResponse;

export default function CarFixture() {
  return <CarDetailPage car={fixtureCar} reviews={fixtureReviews} />;
}
