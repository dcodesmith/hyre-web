import { describe, expect, it } from "vitest";

import { parseFleetCarsView, serializeFleetCarsView } from "./fleet-cars-url";

describe("fleet cars URL state", () => {
  it("round trips supported filters, sorting, and pagination", () => {
    const view = parseFleetCarsView(
      new URLSearchParams(
        "filter.make=Lexus&filter.make=Toyota&filter.model=RX%20350&filter.status=AVAILABLE&filter.status=HOLD&column.hidden=year&page=2&pageSize=20&sort=dayRate:desc",
      ),
    );

    expect(view).toEqual({
      make: ["Lexus", "Toyota"],
      model: ["RX 350"],
      status: ["AVAILABLE", "HOLD"],
      hiddenColumns: ["year"],
      page: 2,
      pageSize: 20,
      sortBy: "dayRate",
      sortDirection: "desc",
    });
    expect(parseFleetCarsView(serializeFleetCarsView(view))).toEqual(view);
  });

  it("normalizes unsupported URL values", () => {
    expect(
      parseFleetCarsView(
        new URLSearchParams(
          "filter.status=UNKNOWN&column.hidden=registrationNumber&page=-1&pageSize=100&sort=ownerId:desc",
        ),
      ),
    ).toEqual({
      make: [],
      model: [],
      status: [],
      hiddenColumns: [],
      page: 1,
      pageSize: 10,
      sortBy: null,
      sortDirection: "asc",
    });
  });

  it("keeps valid filter values when another value is invalid", () => {
    const tooLong = "x".repeat(101);

    expect(
      parseFleetCarsView(
        new URLSearchParams(
          `filter.make=${tooLong}&filter.make=Lexus&filter.make=Lexus&filter.status=UNKNOWN&filter.status=AVAILABLE`,
        ),
      ),
    ).toMatchObject({
      make: ["Lexus"],
      status: ["AVAILABLE"],
    });
  });

  it("round trips filter values containing commas", () => {
    const view = parseFleetCarsView(new URLSearchParams("filter.model=C%2C+300"));

    expect(view.model).toEqual(["C, 300"]);
    expect(parseFleetCarsView(serializeFleetCarsView(view)).model).toEqual(["C, 300"]);
  });
});
