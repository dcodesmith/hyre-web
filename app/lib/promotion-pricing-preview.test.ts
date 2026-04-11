import { describe, expect, it } from "vitest";
import { summarizePromotionPricingLegs } from "./promotion-pricing-preview";

describe("summarizePromotionPricingLegs", () => {
  it("returns standard-only segments when no promo applies", () => {
    const preview = summarizePromotionPricingLegs([
      { basePrice: 1000, finalPrice: 1000, promotion: null },
      { basePrice: 1000, finalPrice: 1000, promotion: null },
      { basePrice: 1000, finalPrice: 1000, promotion: null },
    ]);

    expect(preview.discountCoverage).toBe("NONE");
    expect(preview.baseTotal).toBe(3000);
    expect(preview.compareAtBaseTotal).toBe(3000);
    expect(preview.segments).toEqual([
      {
        kind: "STANDARD",
        units: 3,
        unitPrice: 1000,
        total: 3000,
        compareAtUnitPrice: null,
        label: null,
      },
    ]);
  });

  it("returns promo-only segment when all legs are discounted", () => {
    const preview = summarizePromotionPricingLegs([
      {
        basePrice: 1000,
        finalPrice: 750,
        promotion: { id: "p1", discountValue: 25, name: null },
      },
      {
        basePrice: 1000,
        finalPrice: 750,
        promotion: { id: "p1", discountValue: 25, name: null },
      },
      {
        basePrice: 1000,
        finalPrice: 750,
        promotion: { id: "p1", discountValue: 25, name: null },
      },
    ]);

    expect(preview.discountCoverage).toBe("FULL");
    expect(preview.baseTotal).toBe(2250);
    expect(preview.compareAtBaseTotal).toBe(3000);
    expect(preview.segments).toEqual([
      {
        kind: "PROMO",
        units: 3,
        unitPrice: 750,
        total: 2250,
        compareAtUnitPrice: 1000,
        label: "25% OFF",
      },
    ]);
  });

  it("returns split segments when promo applies to only part of the stay", () => {
    const preview = summarizePromotionPricingLegs([
      {
        basePrice: 1000,
        finalPrice: 750,
        promotion: { id: "p1", discountValue: 25, name: "Easter Sale" },
      },
      {
        basePrice: 1000,
        finalPrice: 750,
        promotion: { id: "p1", discountValue: 25, name: "Easter Sale" },
      },
      { basePrice: 1000, finalPrice: 1000, promotion: null },
    ]);

    expect(preview.discountCoverage).toBe("PARTIAL");
    expect(preview.baseTotal).toBe(2500);
    expect(preview.compareAtBaseTotal).toBe(3000);
    expect(preview.segments).toEqual([
      {
        kind: "PROMO",
        units: 2,
        unitPrice: 750,
        total: 1500,
        compareAtUnitPrice: 1000,
        label: "Easter Sale",
      },
      {
        kind: "STANDARD",
        units: 1,
        unitPrice: 1000,
        total: 1000,
        compareAtUnitPrice: null,
        label: null,
      },
    ]);
  });
});
