import { cn, formatCurrency } from "~/lib/utils";
import { BookingType, BOOKING_TYPE_LABELS, AIRPORT_PICKUP_BOOKING_TYPE } from "../bookingTypes";

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
}: BookingCostBreakdownProps) {
  const unitLabel =
    totalDays === 1
      ? BOOKING_TYPE_LABELS[bookingType].singular
      : BOOKING_TYPE_LABELS[bookingType].plural;

  const bookingTypeLabel =
    bookingType === AIRPORT_PICKUP_BOOKING_TYPE
      ? "Airport Pickup"
      : `${formatCurrency(currentCarPrice)} × ${totalDays} ${unitLabel}`;

  return (
    <div className="w-full mb-8 lg:mb-0">
      <h3 className="text-sm font-semibold mb-2">Cost Breakdown</h3>
      <div className="bg-white border border-neutral-200 lg:border-none rounded shadow-xl inset-shadow-sm transform-gpu p-4 lg:bg-transparent lg:shadow-none lg:rounded-none lg:px-0 lg:py-0">
        <dl className="text-gray-950 text-sm transition-all duration-200">
          <div className="flex justify-between mb-1.5">
            <dt className="text-gray-600">{bookingTypeLabel}</dt>
            <dd className="font-medium">{formatCurrency(baseTotal)}</dd>
          </div>
          {!pricingIncludesFuel && bookingType !== AIRPORT_PICKUP_BOOKING_TYPE && (
            <div
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
            className={cn(
              "flex justify-between transition-all duration-200 ease-out",
              platformFee > 0 ? "opacity-100 h-6 mb-1.5" : "opacity-0 h-0 mb-0 overflow-hidden",
            )}
          >
            <dt className="text-gray-600">Platform Fee ({platformServiceFeeRate.toFixed(1)}%)</dt>
            <dd className="font-medium">{formatCurrency(platformFee)}</dd>
          </div>
          <div
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
          <div className="flex justify-between">
            <dt className="text-gray-600">VAT ({vatRate.toFixed(1)}%)</dt>
            <dd className="font-medium">{formatCurrency(vat)}</dd>
          </div>
          {/* Hide total on mobile (shown in sticky footer), show on desktop */}
          <div className="hidden lg:block">
            <hr className="border-t border-gray-200 my-2" />
            <div className="flex justify-between text-base font-semibold">
              <dt className="text-gray-600">Total</dt>
              <dd>{formatCurrency(finalTotalCost)}</dd>
            </div>
          </div>
        </dl>
      </div>
    </div>
  );
}
