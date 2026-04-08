import { Decimal } from "decimal.js";

export interface CustomerChargeBreakdown {
  readonly subtotalAfterDiscounts: Decimal;
  readonly vatAmount: Decimal;
  readonly totalAmount: Decimal;
  readonly customerBenefitAmount: Decimal;
}

/**
 * Customer benefit amount on a booking (promo + credits applied this booking).
 */
export function calculateCustomerBenefitAmount(
  referralDiscountAmount: Decimal,
  bookingCreditsUsed: Decimal,
): Decimal {
  return referralDiscountAmount.plus(bookingCreditsUsed);
}

/**
 * Customer payable side math. Discounts are applied before VAT.
 */
export function calculateCustomerChargeBreakdown(params: {
  subtotalBeforeDiscounts: Decimal;
  referralDiscountAmount: Decimal;
  bookingCreditsUsed: Decimal;
  vatRatePercent: Decimal;
}): CustomerChargeBreakdown {
  const { subtotalBeforeDiscounts, referralDiscountAmount, bookingCreditsUsed, vatRatePercent } =
    params;

  const subtotalAfterDiscounts = Decimal.max(
    subtotalBeforeDiscounts.minus(referralDiscountAmount).minus(bookingCreditsUsed),
    new Decimal(0),
  );
  const vatAmount = subtotalAfterDiscounts.mul(vatRatePercent).div(100);
  const totalAmount = subtotalAfterDiscounts.plus(vatAmount);

  const requestedBenefitAmount = calculateCustomerBenefitAmount(
    referralDiscountAmount,
    bookingCreditsUsed,
  );
  const maxApplicableBenefit = Decimal.max(subtotalBeforeDiscounts, new Decimal(0));
  const customerBenefitAmount = Decimal.min(requestedBenefitAmount, maxApplicableBenefit);

  return {
    subtotalAfterDiscounts,
    vatAmount,
    totalAmount,
    customerBenefitAmount,
  };
}

/**
 * Fleet-owner payable side math.
 * Intentionally independent of discounts/credits because those are platform-funded.
 */
export function calculateFleetOwnerPayoutAmountNet(params: {
  bookingRevenue: Decimal;
  platformFleetOwnerCommissionAmount: Decimal;
}): Decimal {
  return params.bookingRevenue.minus(params.platformFleetOwnerCommissionAmount);
}
