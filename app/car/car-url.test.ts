import { describe, expect, it } from "vitest";

import {
  buildBackToSearchPath,
  buildBookingTypeCarPath,
  buildCarDetailSearchPath,
  parseCarDetailUrl,
  parseReviewsPage,
  shouldRevalidateCarDetail,
} from "~/car/car-url";

const car = {
  id: "cmmz4f7x00000l804jj2d6ikn",
  make: "Lexus",
  model: "UX F-Sport",
  year: 2019,
};

describe("car detail URL contract", () => {
  it("defaults booking type without review sheet state", () => {
    const query = parseCarDetailUrl(new URLSearchParams("vehicleType=SUV"));

    expect(query.bookingType).toBe("DAY");
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
    expect(parseReviewsPage("2junk")).toBe(1);
    expect(parseReviewsPage("2.5")).toBe(1);
    expect(parseReviewsPage("0")).toBe(1);
    expect(parseReviewsPage("3")).toBe(3);
    expect(parseReviewsPage("9007199254740992")).toBe(1);
    expect(parseReviewsPage(`1${"0".repeat(20)}`)).toBe(1);
  });

  it("serializes booking and filters without review sheet state", () => {
    const query = parseCarDetailUrl(
      new URLSearchParams(
        "bookingType=NIGHT&from=2026-08-20&to=2026-08-21&vehicleType=SUV&reviews=1&reviewsPage=2",
      ),
    );

    expect(buildCarDetailSearchPath(car, query)).toBe(
      "/cars/2019-lexus-ux-f-sport-cmmz4f7x00000l804jj2d6ikn?vehicleType=SUV&from=2026-08-20&to=2026-08-21&bookingType=NIGHT",
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

  it("revalidates only when from changes", () => {
    const current = new URLSearchParams("bookingType=DAY&from=2026-08-20");

    expect(
      shouldRevalidateCarDetail(current, new URLSearchParams("bookingType=NIGHT&from=2026-08-20")),
    ).toBe(false);
    expect(
      shouldRevalidateCarDetail(current, new URLSearchParams("bookingType=DAY&from=2026-08-21")),
    ).toBe(true);
    expect(
      shouldRevalidateCarDetail(
        current,
        new URLSearchParams("bookingType=DAY&from=2026-08-20&reviewsPage=2"),
      ),
    ).toBe(false);
  });

  it("builds a back-to-search path without leftover review params", () => {
    expect(
      buildBackToSearchPath(
        new URLSearchParams("bookingType=DAY&vehicleType=SUV&reviews=1&reviewsPage=2"),
      ),
    ).toBe("/search?bookingType=DAY&vehicleType=SUV");
  });
});
