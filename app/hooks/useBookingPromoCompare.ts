import { useMemo } from "react";
import {
  AIRPORT_PICKUP_BOOKING_TYPE,
  type BookingType,
  FULL_DAY_BOOKING_TYPE,
  NIGHT_BOOKING_TYPE,
} from "~/components/bookingTypes";
import { useFinalPricing } from "~/hooks/useBookingPricing";

export type BookingPromoCompare = {
  readonly originalBaseTotal: number;
  readonly compareAtGrandTotal: number;
  readonly originalUnitPrice: number;
  readonly showBaseStrike: boolean;
  readonly showTotalStrike: boolean;
};

export type OriginalListRates = {
  readonly dayRate: number;
  readonly nightRate: number;
  readonly fullDayRate: number;
  readonly airportPickupRate: number;
};

export function listRateForBookingType(bookingType: BookingType, rates: OriginalListRates): number {
  if (bookingType === NIGHT_BOOKING_TYPE) return rates.nightRate;
  if (bookingType === FULL_DAY_BOOKING_TYPE) return rates.fullDayRate;
  if (bookingType === AIRPORT_PICKUP_BOOKING_TYPE) return rates.airportPickupRate;
  return rates.dayRate;
}

type ReferralDiscountState = { eligible: boolean; discountAmount: number } | null;

export function useBookingPromoCompare({
  promotion,
  originalRates,
  totalDays,
  bookingType,
  baseTotal,
  finalTotalCost,
  fuelUpgradeCost,
  platformServiceFeeRate,
  user,
  referralDiscount,
  useCreditsAmount,
  vatRate,
}: {
  readonly promotion: { label: string } | null;
  readonly originalRates: OriginalListRates | null;
  readonly totalDays: number;
  readonly bookingType: BookingType;
  readonly baseTotal: number;
  readonly finalTotalCost: number;
  readonly fuelUpgradeCost: number;
  readonly platformServiceFeeRate: number;
  readonly user: { id: string } | null;
  readonly referralDiscount: ReferralDiscountState;
  readonly useCreditsAmount: number;
  readonly vatRate: number;
}): BookingPromoCompare | null {
  const originalSubtotalBeforeDiscounts = useMemo(() => {
    if (!promotion || !originalRates) return 0;
    const origBase =
      totalDays > 0
        ? listRateForBookingType(bookingType, originalRates) * totalDays
        : originalRates.dayRate;
    const subtotal = origBase + fuelUpgradeCost;
    const platformFeeOnOriginal = subtotal * (platformServiceFeeRate / 100);
    return subtotal + platformFeeOnOriginal;
  }, [promotion, originalRates, totalDays, bookingType, fuelUpgradeCost, platformServiceFeeRate]);

  const originalReferralDiscountAmount = useMemo(() => {
    if (!promotion || !originalRates || originalSubtotalBeforeDiscounts <= 0) return 0;
    if (!user || !referralDiscount?.eligible) return 0;
    return Math.min(referralDiscount.discountAmount || 0, originalSubtotalBeforeDiscounts);
  }, [promotion, originalRates, originalSubtotalBeforeDiscounts, user, referralDiscount]);

  const { finalTotalCost: compareAtGrandTotal } = useFinalPricing({
    subtotalBeforeDiscounts: originalSubtotalBeforeDiscounts,
    referralDiscountAmount: originalReferralDiscountAmount,
    useCreditsAmount,
    vatRate,
  });

  return useMemo(() => {
    if (!promotion || !originalRates) return null;
    const originalBaseTotal =
      totalDays > 0
        ? listRateForBookingType(bookingType, originalRates) * totalDays
        : originalRates.dayRate;
    const originalUnitPrice = listRateForBookingType(bookingType, originalRates);
    const showBaseStrike = originalBaseTotal > baseTotal;
    const showTotalStrike = compareAtGrandTotal > finalTotalCost;
    if (!showBaseStrike && !showTotalStrike) return null;
    return {
      originalBaseTotal,
      compareAtGrandTotal,
      originalUnitPrice,
      showBaseStrike,
      showTotalStrike,
    };
  }, [
    promotion,
    originalRates,
    totalDays,
    bookingType,
    baseTotal,
    compareAtGrandTotal,
    finalTotalCost,
  ]);
}
