import { describe, expect, it } from "vitest";

import {
  carReviewsResponseSchema,
  customerReviewSchema,
  reviewMutationResponseSchema,
} from "./schema";

describe("carReviewsResponseSchema", () => {
  it("keeps review fields the public list needs and accepts extra API keys", () => {
    const parsed = carReviewsResponseSchema.safeParse({
      reviews: [
        {
          id: "cmreviewfixture0000000001",
          overallRating: 5,
          carRating: 5,
          chauffeurRating: 4,
          serviceRating: 5,
          comment: "Great ride",
          createdAt: "2026-08-10T09:00:00.000Z",
          user: { id: "cmuserfixture000000000001", name: null, image: null },
          booking: { id: "ignored", carId: "ignored" },
          isVisible: true,
        },
      ],
      pagination: {
        page: 1,
        limit: 12,
        total: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
      ratings: {
        averageRating: 5,
        totalReviews: 1,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 1 },
      },
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.reviews[0]).not.toHaveProperty("booking");
      expect(parsed.data.reviews[0]?.user.name).toBeNull();
    }
  });
});

describe("customer review schemas", () => {
  const review = {
    id: "cmreviewfixture0000000001",
    overallRating: 5,
    carRating: 4,
    chauffeurRating: 5,
    serviceRating: 4,
    comment: "Great ride",
    createdAt: "2026-08-10T09:00:00.000Z",
    user: { id: "cmuserfixture000000000001", name: "Ada", image: null },
  };

  it("validates the review embedded in a booking response", () => {
    expect(customerReviewSchema.parse({ ...review, moderationNotes: "ignored" })).toEqual(review);
  });

  it("only keeps the identity from mutation responses", () => {
    expect(reviewMutationResponseSchema.parse({ ...review, bookingId: "booking-1" })).toEqual({
      id: review.id,
    });
  });
});
