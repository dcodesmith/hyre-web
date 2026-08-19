import { describe, expect, it } from "vitest";

import { buildResultsHeading, buildSearchSeoContext } from "~/search/search-heading";

describe("search heading and SEO copy", () => {
  it("names a single vehicle type and joins multiple types", () => {
    expect(buildResultsHeading(6, [])).toBe("6 vehicles");
    expect(buildResultsHeading(1, [])).toBe("1 vehicle");
    expect(buildResultsHeading(6, ["SEDAN"])).toBe("6 sedans");
    expect(buildResultsHeading(1, ["SUV"])).toBe("1 SUV");
    expect(buildResultsHeading(23, ["SUV", "SEDAN"])).toBe("23 SUVs and sedans");
    expect(buildResultsHeading(1, ["SUV", "SEDAN"])).toBe("1 SUV or sedan");
  });

  it("builds title parts only for a single selected type or non-day booking", () => {
    expect(buildSearchSeoContext({ vehicleTypes: ["SUV"] }).titleParts).toEqual(["SUV"]);
    expect(buildSearchSeoContext({ vehicleTypes: ["SUV", "SEDAN"] }).titleParts).toEqual([]);
    expect(buildSearchSeoContext({ bookingType: "NIGHT" }).titleParts).toEqual(["Night Service"]);
    expect(buildSearchSeoContext({ bookingType: "DAY" }).titleParts).toEqual([]);
    expect(buildSearchSeoContext({ serviceTiers: ["LUXURY"] }).descriptionContext).toBe(
      "Luxury vehicles",
    );
  });
});
