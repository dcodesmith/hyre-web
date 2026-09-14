import { describe, expect, it } from "vitest";

import { fleetOwnerPromotionMutationSchema, fleetOwnerPromotionsSchema } from "./schema";

const promotion = {
  id: "018f47a2-7b3c-7d4e-8f90-1234567890d1",
  ownerId: "018f47a2-7b3c-7d4e-8f90-123456789461",
  carId: null,
  name: "Weekend deal",
  discountValue: "12.50",
  startDate: "2027-01-01T00:00:00.000Z",
  endDate: "2027-01-04T00:00:00.000Z",
  isActive: true,
  createdAt: "2026-12-01T00:00:00.000Z",
  updatedAt: "2026-12-01T00:00:00.000Z",
};

describe("fleet-owner promotion API schemas", () => {
  it("parses Prisma decimal promotion responses", () => {
    expect(fleetOwnerPromotionMutationSchema.parse(promotion).discountValue).toBe(12.5);
    expect(fleetOwnerPromotionsSchema.parse([{ ...promotion, car: null }])[0].car).toBeNull();
  });

  it("rejects malformed promotion dates", () => {
    expect(
      fleetOwnerPromotionMutationSchema.safeParse({ ...promotion, startDate: "2027-01-01" })
        .success,
    ).toBe(false);
  });
});
