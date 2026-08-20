import { describe, expect, it } from "vitest";

import type { CarCategory } from "~/api/cars/schema";
import {
  buildCarDetailPath,
  buildCategorySearchPath,
  extractCarIdFromSlug,
  generateCarSlug,
  getCategorySectionId,
} from "~/car/paths";

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

  it("builds a canonical car detail URL with the full CUID", () => {
    expect(
      buildCarDetailPath({
        id: "cmmz4f7x00000l804jj2d6ikn",
        make: "Lexus",
        model: "UX F-Sport",
        year: 2019,
      }),
    ).toBe("/cars/2019-lexus-ux-f-sport-cmmz4f7x00000l804jj2d6ikn?bookingType=DAY");
  });

  it("extracts a full CUID from a slug and rejects hireApp 13-character prefixes", () => {
    const car = {
      id: "cmmz4f7x00000l804jj2d6ikn",
      make: "Lexus",
      model: "UX F-Sport",
      year: 2019,
    };

    expect(extractCarIdFromSlug(generateCarSlug(car))).toBe(car.id);
    expect(extractCarIdFromSlug(car.id)).toBe(car.id);
    expect(extractCarIdFromSlug("2019-lexus-ux-f-sport-cmmz4f7x00000")).toBeNull();
    expect(extractCarIdFromSlug("not-a-car")).toBeNull();
  });

  it("copies current search filters onto the car detail URL", () => {
    expect(
      buildCarDetailPath(
        {
          id: "cmmz4f7x00000l804jj2d6ikn",
          make: "Lexus",
          model: "UX F-Sport",
          year: 2019,
        },
        "NIGHT",
        {
          preserveSearch: new URLSearchParams(
            "bookingType=DAY&from=2026-08-20&vehicleType=SUV&page=2",
          ),
        },
      ),
    ).toBe(
      "/cars/2019-lexus-ux-f-sport-cmmz4f7x00000l804jj2d6ikn?vehicleType=SUV&from=2026-08-20&bookingType=NIGHT",
    );
  });

  it("overlays booking fields onto a preserved search query", () => {
    expect(
      buildCarDetailPath(
        {
          id: "cmmz4f7x00000l804jj2d6ikn",
          make: "Lexus",
          model: "UX F-Sport",
          year: 2019,
        },
        "AIRPORT_PICKUP",
        {
          from: "2026-08-21",
          to: null,
          pickupTime: null,
          flightNumber: "P4 7501",
          preserveSearch: new URLSearchParams(
            "bookingType=DAY&from=2026-08-20&to=2026-08-21&pickupTime=9 AM&vehicleType=SUV",
          ),
        },
      ),
    ).toBe(
      "/cars/2019-lexus-ux-f-sport-cmmz4f7x00000l804jj2d6ikn?vehicleType=SUV&from=2026-08-21&bookingType=AIRPORT_PICKUP&flightNumber=P4+7501",
    );
  });
});
