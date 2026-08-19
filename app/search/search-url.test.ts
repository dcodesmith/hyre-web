import { describe, expect, it } from "vitest";

import {
  applySearchFiltersToParams,
  buildSearchPath,
  clearSearchFiltersPath,
  countActiveSearchFilters,
  emptySearchFilters,
  parseSearchUrl,
  serializeSearchUrl,
  toApiSearchParams,
} from "~/search/search-url";

describe("search URL contract", () => {
  it("parses homepage booking params and category filter names", () => {
    const query = parseSearchUrl(
      new URLSearchParams(
        "bookingType=DAY&from=2026-08-20&to=2026-08-21&pickupTime=9%20AM&vehicleType=SUV",
      ),
    );

    expect(query).toMatchObject({
      bookingType: "DAY",
      from: "2026-08-20",
      to: "2026-08-21",
      pickupTime: "9 AM",
      vehicleTypes: ["SUV"],
      page: 1,
      limit: 12,
      countOnly: false,
    });
  });

  it("parses comma-separated filters, boolean flags, and ISO dates", () => {
    const query = parseSearchUrl(
      new URLSearchParams(
        "vehicleType=suv,SEDAN,suv&serviceTier=LUXURY&make=Toyota,Lexus&fuelIncluded=1&dealsOnly=true&minPrice=50000&maxPrice=200000&from=2026-08-20T09:00:00.000Z",
      ),
    );

    expect(query.vehicleTypes).toEqual(["SUV", "SEDAN"]);
    expect(query.serviceTiers).toEqual(["LUXURY"]);
    expect(query.makes).toEqual(["Toyota", "Lexus"]);
    expect(query.fuelIncluded).toBe(true);
    expect(query.dealsOnly).toBe(true);
    expect(query.minPrice).toBe(50_000);
    expect(query.maxPrice).toBe(200_000);
    expect(query.from).toBe("2026-08-20");
  });

  it("drops invalid enums, inverted prices, and malformed pickup times", () => {
    const query = parseSearchUrl(
      new URLSearchParams(
        "vehicleType=TRUCK&bookingType=WEEKEND&minPrice=200&maxPrice=50&pickupTime=25:99&page=0&limit=999",
      ),
    );

    expect(query.vehicleTypes).toEqual([]);
    expect(query.bookingType).toBeNull();
    expect(query.minPrice).toBe(200);
    expect(query.maxPrice).toBeNull();
    expect(query.pickupTime).toBeNull();
    expect(query.page).toBe(1);
    expect(query.limit).toBe(50);
  });

  it("serializes API params as comma-separated lists and 1-flags", () => {
    const params = toApiSearchParams(
      parseSearchUrl(
        new URLSearchParams("vehicleType=SUV,SEDAN&fuelIncluded=1&dealsOnly=true&page=2"),
      ),
    );

    expect(params.get("vehicleType")).toBe("SUV,SEDAN");
    expect(params.get("fuelIncluded")).toBe("1");
    expect(params.get("dealsOnly")).toBe("1");
    expect(params.get("page")).toBe("2");
    expect(params.get("limit")).toBe("12");
  });

  it("omits default page from the browser URL and resets page when filters change", () => {
    const params = serializeSearchUrl(
      parseSearchUrl(new URLSearchParams("vehicleType=SUV&page=1")),
    );

    expect(params.has("page")).toBe(false);
    expect(buildSearchPath(params)).toBe("/search?vehicleType=SUV");

    const next = applySearchFiltersToParams(
      new URLSearchParams("vehicleType=SUV&page=3&from=2026-08-20"),
      { ...emptySearchFilters(), vehicleTypes: ["SEDAN"] },
    );

    expect(next.get("vehicleType")).toBe("SEDAN");
    expect(next.get("from")).toBe("2026-08-20");
    expect(next.has("page")).toBe(false);
  });

  it("counts active filters and can clear them without dropping booking params", () => {
    const params = new URLSearchParams(
      "from=2026-08-20&bookingType=NIGHT&vehicleType=SUV&dealsOnly=1&page=2",
    );
    const filters = parseSearchUrl(params);

    expect(countActiveSearchFilters(filters)).toBe(2);
    expect(clearSearchFiltersPath(params)).toBe("/search?from=2026-08-20&bookingType=NIGHT");
  });
});
