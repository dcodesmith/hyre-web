import { describe, expect, it } from "vitest";

import type { BookingPricingPreview } from "~/api/bookings/schema";
import { BOOKING_TYPE_OPTIONS, type BookingType } from "~/booking/types";
import {
  bookingPricingSelectionKey,
  canAuthorizeBookingPayment,
  DEFAULT_PLATFORM_FEE_RATE,
  DEFAULT_VAT_RATE,
  estimateBookingCost,
  expectedBookingTotalAmount,
  overlayBookingCostPreview,
  pricingPreviewForSelection,
  resolvePlatformFeeRate,
  resolveVatRate,
} from "./booking-estimate";

const rates = {
  dayRate: 100_000,
  nightRate: 80_000,
  fullDayRate: 160_000,
  airportPickupRate: 70_000,
};

const preview = {
  currency: "NGN",
  numberOfLegs: 1,
  discountCoverage: "NONE",
  segments: [
    {
      kind: "STANDARD",
      units: 2,
      unitPrice: 95_000,
      total: 190_000,
      compareAtUnitPrice: null,
      label: null,
      promotion: null,
    },
  ],
  baseTotal: 190_000,
  compareAtBaseTotal: 200_000,
  addons: [
    {
      id: "cmaddonprotocol0000000001",
      code: "PROTOCOL_SERVICE",
      name: "Protocol service",
      pricingUnit: "PER_BOOKING",
      unitPrice: 15_000,
      quantity: 1,
      totalPrice: 15_000,
    },
  ],
  addonTotal: 15_000,
  fuelUpgradeCost: 15_000,
  platformFeeRatePercent: 10,
  platformFeeAmount: 19_000,
  compareAtPlatformFeeAmount: 20_000,
  subtotalBeforeDiscounts: 224_000,
  compareAtSubtotalBeforeDiscounts: 235_000,
  referralDiscountAmount: 5_000,
  creditsUsed: 2_000,
  subtotalAfterDiscounts: 217_000,
  vatRatePercent: 7.5,
  vatAmount: 14_250,
  compareAtVatAmount: 15_000,
  totalAmount: 231_250,
  compareAtTotalAmount: 250_000,
  savingsAmount: 18_750,
} satisfies BookingPricingPreview;

describe("resolvePlatformFeeRate", () => {
  it("keeps an explicit zero and falls back for invalid values", () => {
    expect(resolvePlatformFeeRate(0)).toBe(0);
    expect(resolvePlatformFeeRate(10)).toBe(10);
    expect(resolvePlatformFeeRate(-1)).toBe(DEFAULT_PLATFORM_FEE_RATE);
    expect(resolvePlatformFeeRate(undefined)).toBe(DEFAULT_PLATFORM_FEE_RATE);
    expect(resolvePlatformFeeRate("nope")).toBe(DEFAULT_PLATFORM_FEE_RATE);
  });
});

describe("resolveVatRate", () => {
  it("falls back for missing, zero, or invalid VAT", () => {
    expect(resolveVatRate(7.5)).toBe(7.5);
    expect(resolveVatRate(0)).toBe(DEFAULT_VAT_RATE);
    expect(resolveVatRate(-1)).toBe(DEFAULT_VAT_RATE);
    expect(resolveVatRate(undefined)).toBe(DEFAULT_VAT_RATE);
  });
});

describe("estimateBookingCost", () => {
  it("uses one unit when dates are incomplete", () => {
    const estimate = estimateBookingCost({
      ...rates,
      bookingType: "DAY",
      units: 1,
      platformFeeRate: 10,
      vatRate: 7.5,
    });

    expect(estimate.units).toBe(1);
    expect(estimate.baseRate).toBe(100_000);
    expect(estimate.baseTotal).toBe(100_000);
    expect(estimate.platformFee).toBe(10_000);
    expect(estimate.vat).toBe(8_250);
    expect(estimate.finalTotal).toBe(118_250);
  });

  it.each(BOOKING_TYPE_OPTIONS)("uses the %s list rate", (bookingType: BookingType) => {
    const estimate = estimateBookingCost({
      ...rates,
      bookingType,
      units: 1,
    });
    const expectedRate = {
      DAY: 100_000,
      NIGHT: 80_000,
      FULL_DAY: 160_000,
      AIRPORT_PICKUP: 70_000,
    }[bookingType];

    expect(estimate.baseRate).toBe(expectedRate);
    expect(estimate.baseTotal).toBe(expectedRate);
  });

  it("scales the rental total when units change", () => {
    const estimate = estimateBookingCost({
      ...rates,
      bookingType: "DAY",
      units: 3,
      platformFeeRate: 10,
      vatRate: 7.5,
    });

    expect(estimate.baseTotal).toBe(300_000);
    expect(estimate.platformFee).toBe(30_000);
    expect(estimate.vat).toBe(24_750);
    expect(estimate.finalTotal).toBe(354_750);
  });

  it("discounts the rental rate and charges VAT on the promo base", () => {
    const estimate = estimateBookingCost({
      ...rates,
      bookingType: "DAY",
      units: 1,
      platformFeeRate: 5,
      vatRate: 7.5,
      promotion: { discountValue: 10 },
    });

    expect(estimate.baseRate).toBe(90_000);
    expect(estimate.originalBaseRate).toBe(100_000);
    expect(estimate.platformFee).toBe(4_500);
    expect(estimate.vat).toBe(7_087.5);
    expect(estimate.finalTotal).toBe(101_587.5);
    expect(estimate.originalGrandTotal).toBe(112_875);
    expect(estimate.savingsAmount).toBe(11_287.5);
  });

  it("adds a day-booking fuel upgrade only when it applies", () => {
    const applicable = estimateBookingCost({
      ...rates,
      bookingType: "DAY",
      units: 2,
      platformFeeRate: 10,
      vatRate: 7.5,
      requiresFullTank: true,
      fuelUpgradeRate: 15_000,
    });
    const skipped = estimateBookingCost({
      ...rates,
      bookingType: "NIGHT",
      units: 2,
      requiresFullTank: true,
      fuelUpgradeRate: 15_000,
    });

    expect(applicable.fuelUpgradeCost).toBe(15_000);
    expect(applicable.platformFee).toBe(21_500);
    expect(applicable.vat).toBe(17_737.5);
    expect(applicable.finalTotal).toBe(254_237.5);
    expect(skipped.fuelUpgradeCost).toBe(0);
  });
});

describe("overlayBookingCostPreview", () => {
  it("keeps the estimate until a preview arrives", () => {
    const estimate = estimateBookingCost({
      ...rates,
      bookingType: "DAY",
      units: 1,
      platformFeeRate: 10,
      vatRate: 7.5,
    });
    const display = overlayBookingCostPreview(estimate, null);

    expect(display.totalAmount).toBe(118_250);
    expect(display.addons).toEqual([]);
    expect(display.referralDiscountAmount).toBe(0);
    expect(display.creditsUsed).toBe(0);
    expect(display.rentalRows[0]?.unitPrice).toBe(100_000);
  });

  it("replaces estimated money with preview values", () => {
    const estimate = estimateBookingCost({
      ...rates,
      bookingType: "DAY",
      units: 1,
      platformFeeRate: 10,
      vatRate: 7.5,
    });
    const display = overlayBookingCostPreview(estimate, preview);

    expect(display.rentalRows).toEqual([
      {
        key: "STANDARD:::::2:95000::190000",
        units: 2,
        unitPrice: 95_000,
        compareAtUnitPrice: null,
        total: 190_000,
      },
    ]);
    expect(display.addons).toEqual(preview.addons);
    expect(display.fuelUpgradeCost).toBe(15_000);
    expect(display.platformFeeAmount).toBe(19_000);
    expect(display.vatAmount).toBe(14_250);
    expect(display.referralDiscountAmount).toBe(5_000);
    expect(display.creditsUsed).toBe(2_000);
    expect(display.totalAmount).toBe(231_250);
    expect(display.savingsAmount).toBe(18_750);
  });
});

describe("authoritative preview payment", () => {
  it("only exposes expectedTotalAmount from a preview", () => {
    expect(expectedBookingTotalAmount(undefined)).toBe("");
    expect(expectedBookingTotalAmount(preview)).toBe("231250");
  });

  it("disables payment without a current successful preview", () => {
    expect(canAuthorizeBookingPayment(null, false, null)).toBe(false);
    expect(canAuthorizeBookingPayment(preview, true, null)).toBe(false);
    expect(canAuthorizeBookingPayment(preview, false, "Unavailable")).toBe(false);
    expect(canAuthorizeBookingPayment(preview, false, null)).toBe(true);
  });

  it("does not authorize action pricing for a different selection", () => {
    const submittedSelection = {
      bookingType: "DAY" as const,
      from: "2026-09-01",
      to: "2026-09-01",
      pickupTime: "9 AM",
    };
    const submittedKey = bookingPricingSelectionKey(submittedSelection);

    expect(pricingPreviewForSelection(preview, submittedKey, submittedSelection)).toBe(preview);
    expect(
      pricingPreviewForSelection(preview, submittedKey, {
        ...submittedSelection,
        bookingType: "FULL_DAY",
        to: "2026-09-02",
      }),
    ).toBeUndefined();
  });

  it("normalizes night pickup time in selection keys", () => {
    expect(
      bookingPricingSelectionKey({
        bookingType: "NIGHT",
        from: "2026-09-01",
        to: "2026-09-02",
        pickupTime: "",
      }),
    ).toBe("NIGHT|2026-09-01|2026-09-02|11 PM|");
  });

  it("normalizes airport pickup to the selected date", () => {
    expect(
      bookingPricingSelectionKey({
        bookingType: "AIRPORT_PICKUP",
        from: "2026-09-01",
        to: "",
        pickupTime: "",
      }),
    ).toBe("AIRPORT_PICKUP|2026-09-01|2026-09-01||");
  });

  it("includes sorted addon ids in the selection key", () => {
    expect(
      bookingPricingSelectionKey({
        bookingType: "DAY",
        from: "2026-09-01",
        to: "2026-09-01",
        pickupTime: "9 AM",
        addonIds: ["cmaddonb00000000000000002", "cmaddona00000000000000001"],
      }),
    ).toBe("DAY|2026-09-01|2026-09-01|9 AM|cmaddona00000000000000001,cmaddonb00000000000000002");
  });
});
