import type { BookingPricingPreview } from "~/api/bookings/schema";
import {
  AIRPORT_PICKUP_BOOKING_TYPE,
  type BookingType,
  FULL_DAY_BOOKING_TYPE,
  NIGHT_BOOKING_TYPE,
} from "~/booking/types";

export const DEFAULT_PLATFORM_FEE_RATE = 0;
export const DEFAULT_VAT_RATE = 7.5;

export type BookingCarRates = {
  readonly dayRate: number;
  readonly nightRate?: number | null;
  readonly fullDayRate?: number | null;
  readonly airportPickupRate?: number | null;
};

export type BookingEstimate = {
  readonly units: number;
  readonly baseRate: number;
  readonly originalBaseRate: number | undefined;
  readonly baseTotal: number;
  readonly platformFee: number;
  readonly platformFeeRate: number;
  readonly vat: number;
  readonly vatRate: number;
  readonly fuelUpgradeCost: number;
  readonly finalTotal: number;
  readonly originalGrandTotal: number | undefined;
  readonly savingsAmount: number | undefined;
};

export type BookingCostRentalRow = {
  readonly key: string;
  readonly units: number;
  readonly unitPrice: number;
  readonly compareAtUnitPrice: number | null;
  readonly total: number;
};

export type BookingCostDisplay = {
  readonly currency: string;
  readonly rentalRows: readonly BookingCostRentalRow[];
  readonly fuelUpgradeCost: number;
  readonly securityDetailCost: number;
  readonly platformFeeRatePercent: number;
  readonly platformFeeAmount: number;
  readonly vatRatePercent: number;
  readonly vatAmount: number;
  readonly referralDiscountAmount: number;
  readonly creditsUsed: number;
  readonly totalAmount: number;
  readonly savingsAmount: number;
};

function toConfiguredRate(raw: unknown): number | undefined {
  if (raw === null || raw === undefined || (typeof raw === "string" && raw.trim() === "")) {
    return undefined;
  }

  const rate = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(rate) ? rate : undefined;
}

export function resolvePlatformFeeRate(raw: unknown): number {
  const rate = toConfiguredRate(raw);
  return rate !== undefined && rate >= 0 ? rate : DEFAULT_PLATFORM_FEE_RATE;
}

export function resolveVatRate(raw: unknown): number {
  const rate = toConfiguredRate(raw);
  return rate !== undefined && rate > 0 ? rate : DEFAULT_VAT_RATE;
}

export function getListRateForBookingType(bookingType: BookingType, rates: BookingCarRates) {
  if (bookingType === NIGHT_BOOKING_TYPE) {
    return rates.nightRate ?? rates.dayRate;
  }

  if (bookingType === FULL_DAY_BOOKING_TYPE) {
    return rates.fullDayRate ?? rates.dayRate;
  }

  if (bookingType === AIRPORT_PICKUP_BOOKING_TYPE) {
    return rates.airportPickupRate ?? rates.dayRate;
  }

  return rates.dayRate;
}

function applyPromotionDiscount(originalRate: number, discountPercent: number) {
  if (originalRate <= 0 || discountPercent <= 0) {
    return originalRate;
  }

  return Math.max(1, originalRate - (originalRate * discountPercent) / 100);
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function fuelUpgradeCost({
  bookingType,
  units,
  requiresFullTank,
  fuelUpgradeRate,
  pricingIncludesFuel,
}: {
  readonly bookingType: BookingType;
  readonly units: number;
  readonly requiresFullTank: boolean;
  readonly fuelUpgradeRate: number;
  readonly pricingIncludesFuel: boolean;
}) {
  if (
    pricingIncludesFuel ||
    units <= 0 ||
    bookingType === FULL_DAY_BOOKING_TYPE ||
    bookingType === NIGHT_BOOKING_TYPE ||
    bookingType === AIRPORT_PICKUP_BOOKING_TYPE ||
    !requiresFullTank ||
    units >= 3
  ) {
    return 0;
  }

  return fuelUpgradeRate;
}

export function estimateBookingCost({
  dayRate,
  nightRate,
  fullDayRate,
  airportPickupRate,
  bookingType,
  units = 1,
  platformFeeRate = DEFAULT_PLATFORM_FEE_RATE,
  vatRate = DEFAULT_VAT_RATE,
  requiresFullTank = false,
  fuelUpgradeRate = 0,
  pricingIncludesFuel = false,
  promotion = null,
}: {
  readonly dayRate: number;
  readonly nightRate?: number | null;
  readonly fullDayRate?: number | null;
  readonly airportPickupRate?: number | null;
  readonly bookingType: BookingType;
  readonly units?: number;
  readonly platformFeeRate?: number;
  readonly vatRate?: number;
  readonly requiresFullTank?: boolean;
  readonly fuelUpgradeRate?: number;
  readonly pricingIncludesFuel?: boolean;
  readonly promotion?: { readonly discountValue: number } | null;
}): BookingEstimate {
  const listRate = getListRateForBookingType(bookingType, {
    dayRate,
    nightRate,
    fullDayRate,
    airportPickupRate,
  });
  const hasPromotion = promotion != null && promotion.discountValue > 0;
  const baseRate = hasPromotion
    ? applyPromotionDiscount(listRate, promotion.discountValue)
    : listRate;
  const billedUnits = Math.max(units, 0);
  const upgradeCost = fuelUpgradeCost({
    bookingType,
    units: billedUnits,
    requiresFullTank,
    fuelUpgradeRate,
    pricingIncludesFuel,
  });
  const baseTotal = roundMoney(baseRate * billedUnits);
  const platformFee = roundMoney(((baseTotal + upgradeCost) * platformFeeRate) / 100);
  const subtotalBeforeVat = roundMoney(baseTotal + platformFee + upgradeCost);
  const vat = roundMoney((subtotalBeforeVat * vatRate) / 100);
  const finalTotal = roundMoney(subtotalBeforeVat + vat);

  if (!hasPromotion) {
    return {
      units: billedUnits,
      baseRate,
      originalBaseRate: undefined,
      baseTotal,
      platformFee,
      platformFeeRate,
      vat,
      vatRate,
      fuelUpgradeCost: upgradeCost,
      finalTotal,
      originalGrandTotal: undefined,
      savingsAmount: undefined,
    };
  }

  const originalBaseTotal = roundMoney(listRate * billedUnits);
  const originalPlatformFee = roundMoney(
    ((originalBaseTotal + upgradeCost) * platformFeeRate) / 100,
  );
  const originalSubtotalBeforeVat = roundMoney(
    originalBaseTotal + originalPlatformFee + upgradeCost,
  );
  const originalGrandTotal = roundMoney(
    originalSubtotalBeforeVat + roundMoney((originalSubtotalBeforeVat * vatRate) / 100),
  );

  return {
    units: billedUnits,
    baseRate,
    originalBaseRate: listRate,
    baseTotal,
    platformFee,
    platformFeeRate,
    vat,
    vatRate,
    fuelUpgradeCost: upgradeCost,
    finalTotal,
    originalGrandTotal,
    savingsAmount: roundMoney(Math.max(0, originalGrandTotal - finalTotal)),
  };
}

export function bookingCostDisplayFromEstimate(estimate: BookingEstimate): BookingCostDisplay {
  return {
    currency: "NGN",
    rentalRows: [
      {
        key: "estimate",
        units: Math.max(estimate.units, 1),
        unitPrice: estimate.baseRate,
        compareAtUnitPrice:
          estimate.originalBaseRate != null && estimate.originalBaseRate > estimate.baseRate
            ? estimate.originalBaseRate
            : null,
        total: estimate.baseTotal,
      },
    ],
    fuelUpgradeCost: estimate.fuelUpgradeCost,
    securityDetailCost: 0,
    platformFeeRatePercent: estimate.platformFeeRate,
    platformFeeAmount: estimate.platformFee,
    vatRatePercent: estimate.vatRate,
    vatAmount: estimate.vat,
    referralDiscountAmount: 0,
    creditsUsed: 0,
    totalAmount: estimate.finalTotal,
    savingsAmount: estimate.savingsAmount ?? 0,
  };
}

export function overlayBookingCostPreview(
  estimate: BookingEstimate,
  preview: BookingPricingPreview | null | undefined,
): BookingCostDisplay {
  const estimated = bookingCostDisplayFromEstimate(estimate);

  if (!preview) {
    return estimated;
  }

  return {
    ...estimated,
    currency: preview.currency,
    rentalRows:
      preview.segments.length > 0
        ? preview.segments.map((segment) => ({
            key: [
              segment.kind,
              segment.promotion?.id ?? "",
              segment.promotion?.startDate ?? "",
              segment.promotion?.endDateExclusive ?? "",
              segment.label ?? "",
              segment.units,
              segment.unitPrice,
              segment.compareAtUnitPrice ?? "",
              segment.total,
            ].join(":"),
            units: segment.units,
            unitPrice: segment.unitPrice,
            compareAtUnitPrice: segment.compareAtUnitPrice,
            total: segment.total,
          }))
        : [
            {
              ...estimated.rentalRows[0],
              total: preview.baseTotal,
            },
          ],
    fuelUpgradeCost: preview.fuelUpgradeCost,
    securityDetailCost: preview.securityDetailCost,
    platformFeeRatePercent: preview.platformFeeRatePercent,
    platformFeeAmount: preview.platformFeeAmount,
    vatRatePercent: preview.vatRatePercent,
    vatAmount: preview.vatAmount,
    referralDiscountAmount: preview.referralDiscountAmount,
    creditsUsed: preview.creditsUsed,
    totalAmount: preview.totalAmount,
    savingsAmount: preview.savingsAmount,
  };
}

export function expectedBookingTotalAmount(preview: BookingPricingPreview | null | undefined) {
  return preview == null ? "" : String(preview.totalAmount);
}

export function canAuthorizeBookingPayment(
  preview: BookingPricingPreview | null | undefined,
  isPreviewLoading: boolean,
  previewError: string | null,
) {
  return preview != null && !isPreviewLoading && previewError == null;
}

type BookingPricingSelection = {
  readonly bookingType: BookingType;
  readonly from: string;
  readonly to: string;
  readonly pickupTime?: string;
};

export function bookingPricingSelectionKey(selection: BookingPricingSelection) {
  const pickupTime = selection.bookingType === NIGHT_BOOKING_TYPE ? "11 PM" : selection.pickupTime;
  const to = selection.bookingType === AIRPORT_PICKUP_BOOKING_TYPE ? selection.from : selection.to;

  return [selection.bookingType, selection.from, to, pickupTime ?? ""].join("|");
}

export function pricingPreviewForSelection(
  preview: BookingPricingPreview | undefined,
  previewSelectionKey: string | undefined,
  selection: BookingPricingSelection,
) {
  return previewSelectionKey === bookingPricingSelectionKey(selection) ? preview : undefined;
}
