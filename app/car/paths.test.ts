import { describe, expect, it } from "vitest";

import type { CarCategory } from "~/api/cars/schema";
import {
  buildCarDetailPath,
  buildCategorySearchPath,
  extractPublicRefFromSlug,
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

  it("builds the canonical semantic URL with color and public ref", () => {
    expect(
      buildCarDetailPath({
        publicRef: "0123456789abcdef",
        color: "Pearl White",
        make: "Lexus",
        model: "UX F-Sport",
        year: 2019,
      }),
    ).toBe("/cars/2019-pearl-white-lexus-ux-f-sport--0123456789abcdef?bookingType=DAY");
  });

  it("extracts only the authoritative final public ref suffix", () => {
    const car = {
      publicRef: "0123456789abcdef",
      color: "Blue-Black",
      make: "Mercedes-Benz",
      model: "GLC-300 4MATIC",
      year: 2019,
    };

    expect(generateCarSlug(car)).toBe(
      "2019-blue-black-mercedes-benz-glc-300-4matic--0123456789abcdef",
    );
    expect(extractPublicRefFromSlug(generateCarSlug(car))).toBe(car.publicRef);
    expect(extractPublicRefFromSlug(`tampered-stale-text--${car.publicRef}`)).toBe(car.publicRef);
    expect(extractPublicRefFromSlug(car.publicRef)).toBeNull();
  });

  it.each([
    "car--0123456789abcde",
    "car--0123456789abcdef0",
    "car--0123456789abcdeF",
    "car--0123456789abcdeg",
    "car--0123456789abcdef-extra",
    "car-0123456789abcdef",
    "not-a-car",
  ])("rejects malformed public ref suffix %s", (slug) => {
    expect(extractPublicRefFromSlug(slug)).toBeNull();
  });

  it("keeps otherwise duplicate cars distinct by public ref", () => {
    const sharedCar = {
      color: "Black",
      make: "Lexus",
      model: "UX",
      year: 2019,
    };

    expect(generateCarSlug({ ...sharedCar, publicRef: "0123456789abcdef" })).not.toBe(
      generateCarSlug({ ...sharedCar, publicRef: "fedcba9876543210" }),
    );
  });

  it("copies current search filters onto the car detail URL", () => {
    expect(
      buildCarDetailPath(
        {
          publicRef: "0123456789abcdef",
          color: "Black",
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
      "/cars/2019-black-lexus-ux-f-sport--0123456789abcdef?vehicleType=SUV&from=2026-08-20&bookingType=NIGHT",
    );
  });

  it("overlays booking fields onto a preserved search query", () => {
    expect(
      buildCarDetailPath(
        {
          publicRef: "0123456789abcdef",
          color: "Black",
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
      "/cars/2019-black-lexus-ux-f-sport--0123456789abcdef?vehicleType=SUV&from=2026-08-21&bookingType=AIRPORT_PICKUP&flightNumber=P4+7501",
    );
  });
});
