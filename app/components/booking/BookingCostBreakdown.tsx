import type { ReactNode } from "react";
import type { BookingPromoCompare } from "~/hooks/useBookingPromoCompare";
import { cn, formatCurrency } from "~/lib/utils";
import {
  AIRPORT_PICKUP_BOOKING_TYPE,
  BOOKING_TYPE_LABELS,
  type BookingType,
} from "../bookingTypes";
import { PromoBookingTotal } from "./PromoBookingTotal";

export type { BookingPromoCompare } from "~/hooks/useBookingPromoCompare";

interface BookingCostBreakdownProps {
  readonly currentCarPrice: number;
  readonly totalDays: number;
  readonly bookingType: BookingType;
  readonly baseTotal: number;
  readonly fuelUpgradeCost: number;
  readonly platformFee: number;
  readonly platformServiceFeeRate: number;
  readonly referralDiscountAmount: number;
  readonly useCreditsAmount: number;
  readonly vatRate: number;
  readonly vat: number;
  readonly finalTotalCost: number;
  readonly pricingIncludesFuel: boolean;
  readonly promoCompare?: BookingPromoCompare | null;
}

export function BookingCostBreakdown({
  currentCarPrice,
  totalDays,
  bookingType,
  baseTotal,
  fuelUpgradeCost,
  platformFee,
  platformServiceFeeRate,
  referralDiscountAmount,
  useCreditsAmount,
  vatRate,
  vat,
  finalTotalCost,
  pricingIncludesFuel,
  promoCompare = null,
}: BookingCostBreakdownProps) {
  const unitLabel =
    totalDays === 1
      ? BOOKING_TYPE_LABELS[bookingType].singular
      : BOOKING_TYPE_LABELS[bookingType].plural;

  let bookingTypeLabel: ReactNode;

  if (bookingType === AIRPORT_PICKUP_BOOKING_TYPE) {
    bookingTypeLabel = "Airport Pickup";
  } else if (promoCompare?.showBaseStrike) {
    bookingTypeLabel = (
      <span className="tabular-nums">
        <span className="text-gray-400 line-through mr-1.5" aria-hidden="true">
          {formatCurrency(promoCompare.originalUnitPrice)}
        </span>
        <span className="text-primary" aria-label="Promotional rate">
          {formatCurrency(currentCarPrice)} × {totalDays} {unitLabel}
        </span>
      </span>
    );
  } else {
    bookingTypeLabel = `${formatCurrency(currentCarPrice)} × ${totalDays} ${unitLabel}`;
  }

  return (
    <section aria-label="Cost breakdown" className="w-full mb-8 lg:mb-0">
      <h3 className="text-sm font-semibold mb-2">Cost Breakdown</h3>
      <div className="bg-white border border-neutral-200 lg:border-none rounded shadow-xl inset-shadow-sm transform-gpu p-4 lg:bg-transparent lg:shadow-none lg:rounded-none lg:px-0 lg:py-0">
        <dl className="text-gray-950 text-sm transition-all duration-200">
          <div className="flex justify-between gap-2 mb-1.5" aria-label="Base price">
            <dt className="text-gray-600 min-w-0">{bookingTypeLabel}</dt>
            <dd className="font-medium shrink-0 text-right">
              {promoCompare?.showBaseStrike ? (
                <span className="tabular-nums">
                  <span className="text-gray-400 line-through mr-2" aria-hidden="true">
                    {formatCurrency(promoCompare.originalBaseTotal)}
                  </span>
                  <span className="text-primary" aria-label="Payable base total">
                    {formatCurrency(baseTotal)}
                  </span>
                </span>
              ) : (
                <span aria-label="Payable base total">{formatCurrency(baseTotal)}</span>
              )}
            </dd>
          </div>
          {!pricingIncludesFuel && bookingType !== AIRPORT_PICKUP_BOOKING_TYPE && (
            <div
              aria-label="Fuel upgrade"
              className={cn(
                "flex justify-between transition-all duration-200 ease-out",
                fuelUpgradeCost > 0
                  ? "opacity-100 h-6 mb-1.5"
                  : "opacity-0 h-0 mb-0 overflow-hidden",
              )}
            >
              <dt className="text-gray-600">Fuel Upgrade to Full Tank</dt>
              <dd className="font-medium">{formatCurrency(fuelUpgradeCost)}</dd>
            </div>
          )}
          <div
            aria-label="Platform fee"
            className={cn(
              "flex justify-between transition-all duration-200 ease-out",
              platformFee > 0 ? "opacity-100 h-6 mb-1.5" : "opacity-0 h-0 mb-0 overflow-hidden",
            )}
          >
            <dt className="text-gray-600">Platform Fee ({platformServiceFeeRate.toFixed(1)}%)</dt>
            <dd className="font-medium">{formatCurrency(platformFee)}</dd>
          </div>
          <div
            aria-label="Referral discount"
            className={cn(
              "flex justify-between transition-all duration-200 ease-out",
              referralDiscountAmount > 0
                ? "opacity-100 h-6 mb-1.5"
                : "opacity-0 h-0 mb-0 overflow-hidden",
            )}
          >
            <dt className="text-green-600">Referral Discount</dt>
            <dd className="text-green-600 font-medium">
              -{formatCurrency(referralDiscountAmount)}
            </dd>
          </div>
          <div
            aria-label="Booking credits"
            className={cn(
              "flex justify-between transition-all duration-200 ease-out",
              useCreditsAmount > 0
                ? "opacity-100 h-6 mb-1.5"
                : "opacity-0 h-0 mb-0 overflow-hidden",
            )}
          >
            <dt className="text-gray-600">Booking Credits</dt>
            <dd className="font-medium">-{formatCurrency(useCreditsAmount)}</dd>
          </div>
          <div className="flex justify-between" aria-label="VAT">
            <dt className="text-gray-600">VAT ({vatRate.toFixed(1)}%)</dt>
            <dd className="font-medium">{formatCurrency(vat)}</dd>
          </div>
          {/* Hide total on mobile (shown in sticky footer), show on desktop */}
          <div className="hidden lg:block">
            <hr className="border-t border-gray-200 my-2" />
            <div
              className="flex justify-between gap-2 text-base font-semibold"
              aria-label="Total cost"
            >
              <dt className="text-gray-600 shrink-0">Total</dt>
              <dd className="text-right min-w-0">
                <PromoBookingTotal
                  promoCompare={promoCompare}
                  finalTotalCost={finalTotalCost}
                  variant="desktop"
                />
              </dd>
            </div>
          </div>
        </dl>
      </div>
    </section>
  );
}
