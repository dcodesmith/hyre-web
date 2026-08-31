import { describe, expect, it } from "vitest";

import { reviewFormSchema } from "./review-form-schema";

const ratings = {
  overallRating: "5",
  carRating: "4",
  chauffeurRating: "5",
  serviceRating: "4",
};

describe("reviewFormSchema", () => {
  it("builds a create payload and omits a blank comment", () => {
    expect(
      reviewFormSchema.parse({
        intent: "create-review",
        ...ratings,
        comment: "  ",
      }),
    ).toEqual({
      intent: "create-review",
      overallRating: 5,
      carRating: 4,
      chauffeurRating: 5,
      serviceRating: 4,
      comment: undefined,
    });
  });

  it("builds an update payload and clears a blank comment", () => {
    expect(
      reviewFormSchema.parse({
        intent: "update-review",
        reviewId: "review-1",
        ...ratings,
        comment: "",
      }),
    ).toEqual({
      intent: "update-review",
      reviewId: "review-1",
      overallRating: 5,
      carRating: 4,
      chauffeurRating: 5,
      serviceRating: 4,
      comment: null,
    });
  });

  it("requires every rating and limits comments", () => {
    const missingRating = reviewFormSchema.safeParse({
      intent: "create-review",
      ...ratings,
      overallRating: "",
      comment: "",
    });
    const longComment = reviewFormSchema.safeParse({
      intent: "create-review",
      ...ratings,
      comment: "x".repeat(2001),
    });

    expect(missingRating.success).toBe(false);
    expect(longComment.success).toBe(false);
  });
});
