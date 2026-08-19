import { describe, expect, it } from "vitest";

import {
  applySearchFiltersToParams,
  buildBookingTypeSearchPath,
  buildSearchPath,
  clearSearchFiltersPath,
  countActiveSearchFilters,
  emptySearchFilters,
  parseSearchUrl,
  searchResultsIdentity,
  serializeSearchUrl,
  shouldRevalidateSearch,
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

  it("rejects malformed integers and impossible calendar dates", () => {
    const query = parseSearchUrl(
      new URLSearchParams(
        "minPrice=12abc&maxPrice=9007199254740992&page=2x&from=2026-02-31&to=2023-02-29",
      ),
    );

    expect(query.minPrice).toBeNull();
    expect(query.maxPrice).toBeNull();
    expect(query.page).toBe(1);
    expect(query.from).toBeNull();
    expect(query.to).toBeNull();

    const leap = parseSearchUrl(new URLSearchParams("from=2024-02-29&minPrice=12"));
    expect(leap.from).toBe("2024-02-29");
    expect(leap.minPrice).toBe(12);
  });

  it("counts active filters and can clear them without dropping booking params", () => {
    const params = new URLSearchParams(
      "from=2026-08-20&bookingType=NIGHT&vehicleType=SUV&dealsOnly=1&page=2",
    );
    const filters = parseSearchUrl(params);

    expect(countActiveSearchFilters(filters)).toBe(2);
    expect(clearSearchFiltersPath(params)).toBe("/search?from=2026-08-20&bookingType=NIGHT");
  });

  it("keeps filters and drops booking fields when booking type changes", () => {
    expect(buildBookingTypeSearchPath("NIGHT")).toBe("/search?bookingType=NIGHT");
    expect(
      buildBookingTypeSearchPath(
        "NIGHT",
        new URLSearchParams(
          "from=2026-08-20&to=2026-08-21&bookingType=DAY&pickupTime=9%20AM&vehicleType=SUV&dealsOnly=1&page=2",
        ),
      ),
    ).toBe("/search?vehicleType=SUV&dealsOnly=1&bookingType=NIGHT");
  });

  it("skips result revalidation when only display booking type changes", () => {
    const current = new URLSearchParams("vehicleType=SUV&bookingType=DAY");
    const next = new URLSearchParams("vehicleType=SUV&bookingType=NIGHT");

    expect(searchResultsIdentity(current)).toBe(searchResultsIdentity(next));
    expect(shouldRevalidateSearch(current, next)).toBe(false);
    expect(shouldRevalidateSearch(current, new URLSearchParams("countOnly=1"))).toBe(false);
  });

  it("revalidates search when dates or price filters make booking type affect the list", () => {
    expect(
      shouldRevalidateSearch(
        new URLSearchParams("from=2026-08-20&to=2026-08-21&bookingType=DAY&vehicleType=SUV"),
        new URLSearchParams("vehicleType=SUV&bookingType=NIGHT"),
      ),
    ).toBe(true);
    expect(
      shouldRevalidateSearch(
        new URLSearchParams("minPrice=50000&bookingType=DAY"),
        new URLSearchParams("minPrice=50000&bookingType=NIGHT"),
      ),
    ).toBe(true);
    expect(
      shouldRevalidateSearch(
        new URLSearchParams("vehicleType=SUV&bookingType=DAY"),
        new URLSearchParams("vehicleType=SEDAN&bookingType=DAY"),
      ),
    ).toBe(true);
    expect(
      shouldRevalidateSearch(
        new URLSearchParams("from=2026-08-20&to=2026-08-21&bookingType=DAY&pickupTime=9%20AM"),
        new URLSearchParams("from=2026-08-20&to=2026-08-21&bookingType=DAY&pickupTime=10%20AM"),
      ),
    ).toBe(true);
    expect(
      shouldRevalidateSearch(
        new URLSearchParams("bookingType=DAY&pickupTime=9%20AM"),
        new URLSearchParams("bookingType=DAY&pickupTime=10%20AM"),
      ),
    ).toBe(false);
  });
});
