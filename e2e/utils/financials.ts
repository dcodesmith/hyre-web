import { Decimal } from "decimal.js";
import { calculateCustomerChargeBreakdown } from "../../app/services/booking-financials";

/**
 * Round a raw number the same way the UI formats NGN currency (0 decimals).
 * This ensures test expectations match the displayed values exactly.
 */
export function toDisplayedCurrencyAmount(amount: number): number {
  const formatted = new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(amount);
  return Number(formatted.replaceAll(/[₦,\s]/g, ""));
}

export function inclusiveDayCount(fromIso: string, toIso: string): number {
  const fromUtc = new Date(`${fromIso}T00:00:00Z`);
  const toUtc = new Date(`${toIso}T00:00:00Z`);
  return Math.round((toUtc.getTime() - fromUtc.getTime()) / 86_400_000) + 1;
}

export interface ExpectedBreakdown {
  baseTotal: number;
  fuelUpgradeCost: number;
  platformFee: number;
  subtotalBeforeDiscounts: number;
  referralDiscount: number;
  creditsUsed: number;
  subtotalAfterDiscounts: number;
  vat: number;
  total: number;
}

/**
 * Compute the expected cost breakdown using the *real* business logic
 * from `app/services/booking-financials.ts`, then normalise each value
 * to the displayed currency format (integer NGN) for exact UI assertions.
 */
export function computeExpectedBreakdown(params: {
  pricePerUnit: number;
  units: number;
  fuelUpgradeCost: number;
  platformFeeRatePercent: number;
  referralDiscountAmount: number;
  creditsUsed: number;
  vatRatePercent: number;
}): ExpectedBreakdown {
  const baseTotal = params.pricePerUnit * params.units;
  const subtotal = baseTotal + params.fuelUpgradeCost;
  const platformFeeRaw = subtotal * (params.platformFeeRatePercent / 100);
  const subtotalBeforeDiscounts = subtotal + platformFeeRaw;

  const result = calculateCustomerChargeBreakdown({
    subtotalBeforeDiscounts: new Decimal(subtotalBeforeDiscounts),
    referralDiscountAmount: new Decimal(params.referralDiscountAmount),
    bookingCreditsUsed: new Decimal(params.creditsUsed),
    vatRatePercent: new Decimal(params.vatRatePercent),
  });

  return {
    baseTotal: toDisplayedCurrencyAmount(baseTotal),
    fuelUpgradeCost: toDisplayedCurrencyAmount(params.fuelUpgradeCost),
    platformFee: toDisplayedCurrencyAmount(platformFeeRaw),
    subtotalBeforeDiscounts: toDisplayedCurrencyAmount(subtotalBeforeDiscounts),
    referralDiscount: toDisplayedCurrencyAmount(params.referralDiscountAmount),
    creditsUsed: toDisplayedCurrencyAmount(params.creditsUsed),
    subtotalAfterDiscounts: toDisplayedCurrencyAmount(result.subtotalAfterDiscounts.toNumber()),
    vat: toDisplayedCurrencyAmount(result.vatAmount.toNumber()),
    total: toDisplayedCurrencyAmount(result.totalAmount.toNumber()),
  };
}
