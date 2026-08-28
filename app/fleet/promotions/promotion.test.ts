import { describe, expect, it } from "vitest";

import { formatPromotionDateRange, getPromotionStatus } from "./promotion";

const window = {
  startDate: "2027-01-10T23:00:00.000Z",
  endDate: "2027-01-13T23:00:00.000Z",
};

describe("promotion display", () => {
  it("derives lifecycle status from the API window", () => {
    expect(getPromotionStatus({ ...window, isActive: false }, "2027-01-11T12:00:00.000Z")).toBe(
      "inactive",
    );
    expect(getPromotionStatus({ ...window, isActive: true }, "2027-01-10T12:00:00.000Z")).toBe(
      "upcoming",
    );
    expect(getPromotionStatus({ ...window, isActive: true }, "2027-01-11T12:00:00.000Z")).toBe(
      "active",
    );
    expect(getPromotionStatus({ ...window, isActive: true }, "2027-01-14T12:00:00.000Z")).toBe(
      "expired",
    );
  });

  it("shows the API's exclusive end as an inclusive Lagos date", () => {
    expect(formatPromotionDateRange(window)).toBe("11–13 Jan 2027");
  });
});
