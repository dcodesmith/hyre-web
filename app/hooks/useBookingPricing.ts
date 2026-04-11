import { useMemo } from "react";
import type { Car } from "@prisma/client";
import {
  BookingType,
  FULL_DAY_BOOKING_TYPE,
  NIGHT_BOOKING_TYPE,
  AIRPORT_PICKUP_BOOKING_TYPE,
} from "~/components/bookingTypes";
import { getFuelTankNote } from "~/components/booking/helpers";

interface UseBookingPricingParams {
  readonly car: Car & { fuelUpgradeRate: number | null; pricingIncludesFuel: boolean };
  readonly bookingType: BookingType;
  readonly totalDays: number;
  readonly requiresFullTank: boolean;
  readonly platformServiceFeeRate: number;
  readonly baseTotalOverride?: number;
}

interface BasePricing {
  readonly currentCarPrice: number;
  readonly baseTotal: number;
  readonly fuelUpgradeCost: number;
  readonly subtotal: number;
  readonly platformFee: number;
  readonly fuelNote: string | null;
  readonly subtotalBeforeDiscounts: number;
}

/**
 * Hook for calculating base booking pricing (before discounts).
 * Use this with useReferralCredits to get the full pricing breakdown.
 */
export function useBookingPricing({
  car,
  bookingType,
  totalDays,
  requiresFullTank,
  platformServiceFeeRate,
  baseTotalOverride,
}: UseBookingPricingParams): BasePricing {
  const currentCarPrice = useMemo(() => {
    if (bookingType === NIGHT_BOOKING_TYPE) {
      return car.nightRate;
    }
    if (bookingType === FULL_DAY_BOOKING_TYPE) {
      return car.fullDayRate;
    }
    if (bookingType === AIRPORT_PICKUP_BOOKING_TYPE) {
      return car.airportPickupRate;
    }
    return car.dayRate;
  }, [bookingType, car.nightRate, car.fullDayRate, car.dayRate, car.airportPickupRate]);

  const baseTotal = useMemo(
    () => baseTotalOverride ?? currentCarPrice * totalDays,
    [baseTotalOverride, currentCarPrice, totalDays],
  );

  const fuelUpgradeCost = useMemo(() => {
    if (car.pricingIncludesFuel) {
      return 0;
    }
    if (
      bookingType === FULL_DAY_BOOKING_TYPE ||
      bookingType === NIGHT_BOOKING_TYPE ||
      bookingType === AIRPORT_PICKUP_BOOKING_TYPE ||
      !requiresFullTank ||
      totalDays >= 3
    ) {
      return 0;
    }
    return Number(car.fuelUpgradeRate ?? 0);
  }, [bookingType, requiresFullTank, car.fuelUpgradeRate, car.pricingIncludesFuel, totalDays]);

  const subtotal = useMemo(() => baseTotal + fuelUpgradeCost, [baseTotal, fuelUpgradeCost]);

  const platformFee = useMemo(
    () => subtotal * (platformServiceFeeRate / 100),
    [subtotal, platformServiceFeeRate],
  );

  const fuelNote = useMemo(
    () => getFuelTankNote(totalDays, requiresFullTank, bookingType, car.pricingIncludesFuel),
    [totalDays, requiresFullTank, bookingType, car.pricingIncludesFuel],
  );

  const subtotalBeforeDiscounts = useMemo(() => subtotal + platformFee, [subtotal, platformFee]);

  return {
    currentCarPrice,
    baseTotal,
    fuelUpgradeCost,
    subtotal,
    platformFee,
    fuelNote,
    subtotalBeforeDiscounts,
  };
}

interface UseFinalPricingParams {
  subtotalBeforeDiscounts: number;
  referralDiscountAmount: number;
  useCreditsAmount: number;
  vatRate: number;
}

interface FinalPricing {
  subtotalAfterDiscounts: number;
  vat: number;
  finalTotalCost: number;
}

/**
 * Hook for calculating final pricing after discounts.
 */
export function useFinalPricing({
  subtotalBeforeDiscounts,
  referralDiscountAmount,
  useCreditsAmount,
  vatRate,
}: UseFinalPricingParams): FinalPricing {
  const subtotalAfterDiscounts = useMemo(
    () => Math.max(0, subtotalBeforeDiscounts - referralDiscountAmount - useCreditsAmount),
    [subtotalBeforeDiscounts, referralDiscountAmount, useCreditsAmount],
  );

  const vat = useMemo(
    () => subtotalAfterDiscounts * (vatRate / 100),
    [subtotalAfterDiscounts, vatRate],
  );

  const finalTotalCost = useMemo(() => subtotalAfterDiscounts + vat, [subtotalAfterDiscounts, vat]);

  return {
    subtotalAfterDiscounts,
    vat,
    finalTotalCost,
  };
}
