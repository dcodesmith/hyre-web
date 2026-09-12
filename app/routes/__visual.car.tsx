import { useSearchParams } from "react-router";

import type { PublicAddon } from "~/api/addons/schema";
import type { BookingPricingPreview } from "~/api/bookings/schema";
import type { PublicCarDetail } from "~/api/cars/schema";
import type { PublicRates } from "~/api/rates/schema";
import type { CarReviewsResponse } from "~/api/reviews/schema";
import { bookingPricingSelectionKey } from "~/booking/booking-estimate";
import { hasCompleteBookingDates } from "~/booking/dates";
import { CarDetailPage } from "~/car/car-detail-page";
import { parseCarDetailUrl } from "~/car/car-url";
import { parseZonedCalendarDate } from "~/time/timezone";

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

const fixturePricing = {
  currency: "NGN",
  numberOfLegs: 1,
  discountCoverage: "NONE",
  segments: [
    {
      kind: "STANDARD",
      units: 1,
      unitPrice: 70_000,
      total: 70_000,
      compareAtUnitPrice: null,
      label: null,
      promotion: null,
    },
  ],
  baseTotal: 70_000,
  compareAtBaseTotal: 70_000,
  addons: [],
  addonTotal: 0,
  fuelUpgradeCost: 0,
  platformFeeRatePercent: 5,
  platformFeeAmount: 3_500,
  compareAtPlatformFeeAmount: 3_500,
  subtotalBeforeDiscounts: 73_500,
  compareAtSubtotalBeforeDiscounts: 73_500,
  referralDiscountAmount: 0,
  creditsUsed: 0,
  subtotalAfterDiscounts: 73_500,
  vatRatePercent: 7.5,
  vatAmount: 5_512.5,
  compareAtVatAmount: 5_512.5,
  totalAmount: 79_012.5,
  compareAtTotalAmount: 79_012.5,
  savingsAmount: 0,
} satisfies BookingPricingPreview;

const fixtureRates = {
  platformCustomerServiceFeeRatePercent: 5,
  vatRatePercent: 7.5,
} satisfies PublicRates;

const fixtureAddons = [
  {
    id: "cmaddonprotocol0000000001",
    code: "PROTOCOL_SERVICE",
    name: "Protocol service",
    description: "Dedicated protocol officer",
    pricingUnit: "PER_BOOKING",
    unitPrice: 15_000,
    currency: "NGN",
  },
] satisfies PublicAddon[];

export default function CarFixture() {
  const [searchParams] = useSearchParams();
  const query = parseCarDetailUrl(searchParams);
  const from = query.search.from ? parseZonedCalendarDate(query.search.from) : undefined;
  const to = query.search.to ? parseZonedCalendarDate(query.search.to) : undefined;
  const hasCompleteDates = hasCompleteBookingDates(query.bookingType, from, to);

  return (
    <CarDetailPage
      car={fixtureCar}
      reviews={fixtureReviews}
      rates={fixtureRates}
      addons={fixtureAddons}
      currentPricing={hasCompleteDates ? fixturePricing : undefined}
      currentPricingSelectionKey={
        hasCompleteDates
          ? bookingPricingSelectionKey({
              bookingType: query.bookingType,
              from: query.search.from ?? "",
              to: query.search.to ?? "",
              pickupTime: query.search.pickupTime ?? "",
            })
          : undefined
      }
    />
  );
}
