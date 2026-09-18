import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BookingCostBreakdown } from "./booking-cost-breakdown";
import type { BookingCostDisplay } from "./booking-estimate";

const cost: BookingCostDisplay = {
  currency: "NGN",
  rentalRows: [
    {
      key: "rental",
      units: 1,
      unitPrice: 100_000,
      compareAtUnitPrice: null,
      total: 100_000,
    },
  ],
  addons: [],
  fuelUpgradeCost: 0,
  platformFeeRatePercent: 5,
  platformFeeAmount: 5_000,
  vatRatePercent: 7.5,
  vatAmount: 7_125,
  referralDiscountAmount: 10_000,
  creditsUsed: 4_500,
  totalAmount: 97_625,
  savingsAmount: 14_500,
};

function renderBreakdown(display: BookingCostDisplay = cost) {
  return renderToStaticMarkup(
    createElement(BookingCostBreakdown, { cost: display, bookingType: "DAY" }),
  );
}

describe("BookingCostBreakdown", () => {
  it("renders automatic referral discount and banked booking credits separately", () => {
    const markup = renderBreakdown();

    expect(markup).toContain("Referral discount");
    expect(markup).toContain("Booking credits");
    expect(markup).toContain("-₦10,000");
    expect(markup).toContain("-₦4,500");
    expect(markup.indexOf("Referral discount")).toBeLessThan(markup.indexOf("Booking credits"));
  });

  it("hides zero discount and credit rows", () => {
    const markup = renderBreakdown({
      ...cost,
      referralDiscountAmount: 0,
      creditsUsed: 0,
      savingsAmount: 0,
    });

    expect(markup).not.toContain("Referral discount");
    expect(markup).not.toContain("Booking credits");
  });
});
