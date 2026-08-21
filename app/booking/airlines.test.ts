import { describe, expect, it } from "vitest";

import {
  extractFlightDigits,
  filterAirlines,
  formatAirlineFlight,
  shouldSuggestAirlines,
} from "~/booking/airlines";

const britishAirways = {
  id: "1355",
  name: "British Airways",
  iata: "BA",
  icao: "BAW",
};

const airPeace = {
  id: "19866",
  name: "Air Peace",
  iata: "P4",
  icao: "APK",
};

describe("airline suggestions", () => {
  it("suggests after two characters or a flight number, not a single letter", () => {
    expect(shouldSuggestAirlines("B")).toBe(false);
    expect(shouldSuggestAirlines("BA")).toBe(true);
    expect(shouldSuggestAirlines("BA74")).toBe(true);
    expect(shouldSuggestAirlines("british")).toBe(false);
  });

  it("matches IATA, ICAO, and short name fragments", () => {
    expect(filterAirlines("BA").map((airline) => airline.iata)).toEqual(["BA"]);
    expect(filterAirlines("BAW").map((airline) => airline.iata)).toEqual(["BA"]);
    expect(filterAirlines("air").some((airline) => airline.iata === "AF")).toBe(true);
  });

  it("extracts digits after the airline code", () => {
    expect(extractFlightDigits("BA74", britishAirways)).toBe("74");
    expect(extractFlightDigits("BAW74", britishAirways)).toBe("74");
    expect(extractFlightDigits("P47579", airPeace)).toBe("7579");
    expect(extractFlightDigits("P4", airPeace)).toBe("");
    expect(formatAirlineFlight(britishAirways, "74")).toBe("BA74");
  });
});
