import { describe, expect, it } from "vitest";

import {
  buildBackToSearchPath,
  buildBookingTypeCarPath,
  buildCarDetailSearchPath,
  parseCarDetailUrl,
  shouldRevalidateCarDetail,
} from "~/car/car-url";

const car = {
  id: "cmmz4f7x00000l804jj2d6ikn",
  make: "Lexus",
  model: "UX F-Sport",
  year: 2019,
};

describe("car detail URL contract", () => {
  it("defaults booking type and review paging", () => {
    const query = parseCarDetailUrl(new URLSearchParams("vehicleType=SUV"));

    expect(query.bookingType).toBe("DAY");
    expect(query.reviewsOpen).toBe(false);
    expect(query.reviewsPage).toBe(1);
    expect(query.sameLocation).toBe(true);
    expect(query.pickupAddress).toBeNull();
    expect(query.search.vehicleTypes).toEqual(["SUV"]);
  });

  it("keeps addresses on the car URL and strips them from back-to-search", () => {
    const query = parseCarDetailUrl(
      new URLSearchParams(
        "bookingType=DAY&pickupAddress=12+Glover+Road&dropOffAddress=Eko+Hotel&sameLocation=false",
      ),
    );

    expect(query.pickupAddress).toBe("12 Glover Road");
    expect(query.dropOffAddress).toBe("Eko Hotel");
    expect(query.sameLocation).toBe(false);
    expect(buildCarDetailSearchPath(car, query)).toContain("pickupAddress=12+Glover+Road");
    expect(
      buildBackToSearchPath(
        new URLSearchParams(buildCarDetailSearchPath(car, query).split("?")[1]),
      ),
    ).toBe("/search?bookingType=DAY");
  });

  it("forces airport pickup to different locations", () => {
    const query = parseCarDetailUrl(new URLSearchParams("bookingType=AIRPORT_PICKUP"));

    expect(query.sameLocation).toBe(false);
    expect(buildCarDetailSearchPath(car, query)).toContain("sameLocation=false");
  });

  it("rejects partial and non-decimal reviewsPage values", () => {
    expect(parseCarDetailUrl(new URLSearchParams("reviewsPage=2junk")).reviewsPage).toBe(1);
    expect(parseCarDetailUrl(new URLSearchParams("reviewsPage=2.5")).reviewsPage).toBe(1);
    expect(parseCarDetailUrl(new URLSearchParams("reviewsPage=0")).reviewsPage).toBe(1);
    expect(parseCarDetailUrl(new URLSearchParams("reviewsPage=3")).reviewsPage).toBe(3);
  });

  it("serializes booking, filters, and review state", () => {
    const query = parseCarDetailUrl(
      new URLSearchParams(
        "bookingType=NIGHT&from=2026-08-20&to=2026-08-21&vehicleType=SUV&reviews=1&reviewsPage=2",
      ),
    );

    expect(buildCarDetailSearchPath(car, query)).toBe(
      "/cars/2019-lexus-ux-f-sport-cmmz4f7x00000l804jj2d6ikn?vehicleType=SUV&from=2026-08-20&to=2026-08-21&bookingType=NIGHT&reviews=1&reviewsPage=2",
    );
  });

  it("clears dates and addresses when the booking type changes", () => {
    const query = parseCarDetailUrl(
      new URLSearchParams(
        "bookingType=DAY&from=2026-08-20&to=2026-08-21&vehicleType=SUV&pickupAddress=12+Glover+Road",
      ),
    );

    expect(buildBookingTypeCarPath(car, "NIGHT", query)).toBe(
      "/cars/2019-lexus-ux-f-sport-cmmz4f7x00000l804jj2d6ikn?vehicleType=SUV&bookingType=NIGHT",
    );
  });

  it("revalidates only when from or the reviews page changes", () => {
    const current = new URLSearchParams("bookingType=DAY&from=2026-08-20&reviews=1");

    expect(
      shouldRevalidateCarDetail(current, new URLSearchParams("bookingType=NIGHT&from=2026-08-20")),
    ).toBe(false);
    expect(
      shouldRevalidateCarDetail(current, new URLSearchParams("bookingType=DAY&from=2026-08-21")),
    ).toBe(true);
    expect(
      shouldRevalidateCarDetail(
        current,
        new URLSearchParams("bookingType=DAY&from=2026-08-20&reviews=1&reviewsPage=2"),
      ),
    ).toBe(true);
  });

  it("builds a back-to-search path without review state", () => {
    expect(
      buildBackToSearchPath(
        new URLSearchParams("bookingType=DAY&vehicleType=SUV&reviews=1&reviewsPage=2"),
      ),
    ).toBe("/search?bookingType=DAY&vehicleType=SUV");
  });
});
