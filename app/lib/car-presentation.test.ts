import { describe, expect, it } from "vitest";

import type { CarCategory } from "~/lib/api/contracts/car-categories";
import {
  applyPromotionDiscount,
  buildCarDetailPath,
  buildCategorySearchPath,
  getCategorySectionId,
  hasActivePromotion,
  isNewListing,
  promotionBadgeLabel,
} from "./car-presentation";

function category(overrides: Partial<CarCategory>): CarCategory {
  return {
    name: "suv",
    title: "SUV",
    type: "vehicleType",
    cars: [],
    ...overrides,
  };
}

describe("car presentation", () => {
  it("builds category URLs using the Nest search contract", () => {
    expect(buildCategorySearchPath(category({ name: "suv" }))).toBe("/search?vehicleType=SUV");
    expect(
      buildCategorySearchPath(
        category({ name: "budget", title: "Budget-friendly", type: "serviceTier" }),
      ),
    ).toBe("/search?serviceTier=STANDARD");
    expect(buildCategorySearchPath(category({ name: "popular", type: "make" }))).toBe("/search");
  });

  it("preserves legacy homepage section anchors", () => {
    expect(getCategorySectionId(category({ name: "suv" }))).toBe("suvs");
    expect(getCategorySectionId(category({ name: "sedan" }))).toBe("sedans");
    expect(getCategorySectionId(category({ name: "luxury" }))).toBe("luxury");
  });

  it("builds the existing SEO-friendly car detail URL", () => {
    expect(
      buildCarDetailPath({
        id: "cmmz4f7x00000l804jj2d6ikn",
        make: "Lexus",
        model: "UX F-Sport",
        year: 2019,
      }),
    ).toBe("/cars/2019-lexus-ux-f-sport-cmmz4f7x00000?bookingType=DAY");
  });

  it("matches the API promotion percentage behavior", () => {
    expect(applyPromotionDiscount(100_000, 12.5)).toBe(87_500);
    expect(promotionBadgeLabel(12.5)).toBe("12.5% OFF");
    expect(promotionBadgeLabel(20)).toBe("20% OFF");
  });

  it("treats a positive discountValue as an active promotion", () => {
    expect(hasActivePromotion(null)).toBe(false);
    expect(hasActivePromotion({ id: "promo-1", name: null, discountValue: 0 })).toBe(false);
    expect(hasActivePromotion({ id: "promo-1", name: "Weekend", discountValue: 15 })).toBe(true);
  });

  it("marks listings newer than seven days as new", () => {
    const now = new Date("2026-08-18T12:00:00.000Z");

    expect(isNewListing(undefined, now)).toBe(false);
    expect(isNewListing("not-a-date", now)).toBe(false);
    expect(isNewListing("2026-08-12T12:00:00.000Z", now)).toBe(true);
    expect(isNewListing("2026-08-11T12:00:00.000Z", now)).toBe(false);
  });
});
