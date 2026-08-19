import { describe, expect, it } from "vitest";

import type { CarCategory } from "~/api/cars/schema";
import { buildCarDetailPath, buildCategorySearchPath, getCategorySectionId } from "~/car/paths";

function category(overrides: Partial<CarCategory>): CarCategory {
  return {
    name: "suv",
    title: "SUV",
    type: "vehicleType",
    cars: [],
    ...overrides,
  };
}

describe("car paths", () => {
  it("builds category URLs using the API search contract", () => {
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
});
