import { Decimal } from "decimal.js";
import { describe, expect, it } from "vitest";
import {
  calculateCustomerBenefitAmount,
  calculateCustomerChargeBreakdown,
  calculateFleetOwnerPayoutAmountNet,
} from "./booking-financials";

describe("booking-financials", () => {
  it("calculates customer total with referral discount and 7.5% VAT", () => {
    const result = calculateCustomerChargeBreakdown({
      subtotalBeforeDiscounts: new Decimal(100000),
      referralDiscountAmount: new Decimal(10000),
      bookingCreditsUsed: new Decimal(0),
      vatRatePercent: new Decimal(7.5),
    });

    expect(result.subtotalAfterDiscounts.equals(new Decimal(90000))).toBe(true);
    expect(result.vatAmount.equals(new Decimal(6750))).toBe(true);
    expect(result.totalAmount.equals(new Decimal(96750))).toBe(true);
    expect(result.customerBenefitAmount.equals(new Decimal(10000))).toBe(true);
  });

  it("calculates fleet payout as bookingRevenue minus commission", () => {
    const payout = calculateFleetOwnerPayoutAmountNet({
      bookingRevenue: new Decimal(100000),
      platformFleetOwnerCommissionAmount: new Decimal(10000),
    });

    expect(payout.equals(new Decimal(90000))).toBe(true);
  });

  it("aggregates customer benefit as referral + credits", () => {
    const subsidy = calculateCustomerBenefitAmount(new Decimal(10000), new Decimal(5000));
    expect(subsidy.equals(new Decimal(15000))).toBe(true);
  });

  it("floors subtotal after discounts at zero", () => {
    const result = calculateCustomerChargeBreakdown({
      subtotalBeforeDiscounts: new Decimal(20000),
      referralDiscountAmount: new Decimal(15000),
      bookingCreditsUsed: new Decimal(10000),
      vatRatePercent: new Decimal(7.5),
    });

    expect(result.subtotalAfterDiscounts.equals(new Decimal(0))).toBe(true);
    expect(result.vatAmount.equals(new Decimal(0))).toBe(true);
    expect(result.totalAmount.equals(new Decimal(0))).toBe(true);
    expect(result.customerBenefitAmount.equals(new Decimal(25000))).toBe(true);
  });
});
