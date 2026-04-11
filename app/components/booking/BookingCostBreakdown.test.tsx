import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DAY_BOOKING_TYPE } from "../bookingTypes";
import { BookingCostBreakdown } from "./BookingCostBreakdown";

function renderBreakdown(
  segments: Parameters<typeof BookingCostBreakdown>[0]["promotionPricingSegments"],
) {
  return renderToStaticMarkup(
    <BookingCostBreakdown
      currentCarPrice={1000}
      totalDays={3}
      bookingType={DAY_BOOKING_TYPE}
      baseTotal={3000}
      fuelUpgradeCost={0}
      platformFee={0}
      platformServiceFeeRate={0}
      referralDiscountAmount={0}
      useCreditsAmount={0}
      vatRate={7.5}
      vat={225}
      finalTotalCost={3225}
      pricingIncludesFuel
      promotionPricingSegments={segments}
      promoCompare={null}
    />,
  );
}

describe("BookingCostBreakdown segmented pricing", () => {
  it("renders standard row when there is no discount", () => {
    const html = renderBreakdown([
      {
        kind: "STANDARD",
        units: 3,
        unitPrice: 1000,
        total: 3000,
        compareAtUnitPrice: null,
        label: null,
      },
    ]);

    expect(html).toContain("₦1,000 × 3 days");
    expect(html).not.toContain("OFF");
  });

  it("renders promo row when full stay is discounted", () => {
    const html = renderBreakdown([
      {
        kind: "PROMO",
        units: 3,
        unitPrice: 750,
        total: 2250,
        compareAtUnitPrice: 1000,
        label: "25% OFF",
      },
    ]);

    expect(html).toContain("₦750 × 3 days");
    expect(html).not.toContain("25% OFF");
  });

  it("renders both promo and standard rows for partial overlap", () => {
    const html = renderBreakdown([
      {
        kind: "PROMO",
        units: 2,
        unitPrice: 750,
        total: 1500,
        compareAtUnitPrice: 1000,
        label: "Easter Sale",
      },
      {
        kind: "STANDARD",
        units: 1,
        unitPrice: 1000,
        total: 1000,
        compareAtUnitPrice: null,
        label: null,
      },
    ]);

    expect(html).toContain("₦750 × 2 days");
    expect(html).toContain("₦1,000 × 1 day");
    expect(html).not.toContain("Easter Sale");
  });
});
