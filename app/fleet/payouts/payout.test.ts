import { describe, expect, it } from "vitest";

import { formatPayoutDate } from "./payout";

describe("payout display", () => {
  it("formats timestamps in Lagos time", () => {
    expect(formatPayoutDate("2026-08-20T23:30:00.000Z")).toBe("21 Aug 2026");
  });

  it("shows a placeholder for missing dates", () => {
    expect(formatPayoutDate(null)).toBe("—");
  });
});
