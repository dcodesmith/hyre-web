import { describe, expect, it } from "vitest";

import { createPromotionFormSchema, deactivatePromotionFormSchema } from "./promotion-form-schema";

const validPromotion = {
  name: "",
  target: "FLEET",
  discountValue: "15",
  startDate: "2027-10-01",
  endDate: "2027-10-03",
};

describe("promotion form schemas", () => {
  it("normalizes the fleet-wide create form", () => {
    expect(createPromotionFormSchema.parse(validPromotion)).toEqual({
      name: undefined,
      target: "FLEET",
      discountValue: 15,
      startDate: "2027-10-01",
      endDate: "2027-10-03",
    });
  });

  it("rejects invalid discount and date ranges", () => {
    const parsed = createPromotionFormSchema.safeParse({
      ...validPromotion,
      discountValue: "51",
      endDate: "2027-09-30",
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues.map((issue) => issue.path[0])).toEqual([
      "discountValue",
      "endDate",
    ]);
  });

  it("requires a UUID promotion id for deactivation", () => {
    expect(
      deactivatePromotionFormSchema.safeParse({
        promotionId: "018f47a2-7b3c-7d4e-8f90-1234567890d1",
      }).success,
    ).toBe(true);
    expect(deactivatePromotionFormSchema.safeParse({ promotionId: "../promotion" }).success).toBe(
      false,
    );
  });
});
