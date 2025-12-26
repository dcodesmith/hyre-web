import { formatCurrency } from "~/lib/utils";
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
  /** Hide the total row (e.g., when shown in a separate sticky footer) */
  readonly hideTotal?: boolean;
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
  hideTotal = false,
}: BookingCostBreakdownProps) {
  return (
    <div className="w-full">
      <h3 className="text-sm lg:text-base font-medium mb-2">Cost Breakdown</h3>
      <div className="bg-gray-50 border border-gray-200 rounded-sm px-4 py-2 lg:bg-transparent lg:border-0 lg:rounded-none lg:px-0 lg:py-0">
        <dl className="text-xs text-gray-950 md:text-sm transition-all duration-200">
          <div className="flex justify-between mb-1.5">
            <dt>
              {formatCurrency(currentCarPrice)} &times; {totalDays}
              {` ${
                totalDays === 1
                  ? BOOKING_TYPE_LABELS[bookingType].singular
                  : BOOKING_TYPE_LABELS[bookingType].plural
              }`}
            </dt>
            <dd className="font-medium">{formatCurrency(baseTotal)}</dd>
          </div>
          {bookingType !== AIRPORT_PICKUP_BOOKING_TYPE && (
            <div
              className={`flex justify-between transition-all duration-200 ease-out ${
                fuelUpgradeCost > 0
                  ? "opacity-100 h-6 mb-1.5"
                  : "opacity-0 h-0 mb-0 overflow-hidden"
              }`}
            >
              <dt>Fuel Upgrade to Full Tank</dt>
              <dd className="font-medium">{formatCurrency(fuelUpgradeCost)}</dd>
            </div>
          )}
          <div
            className={`flex justify-between transition-all duration-200 ease-out ${
              platformFee > 0 ? "opacity-100 h-6 mb-1.5" : "opacity-0 h-0 mb-0 overflow-hidden"
            }`}
          >
            <dt>Platform Fee ({platformServiceFeeRate.toFixed(1)}%)</dt>
            <dd className="font-medium">{formatCurrency(platformFee)}</dd>
          </div>
          <div
            className={`flex justify-between transition-all duration-200 ease-out ${
              referralDiscountAmount > 0
                ? "opacity-100 h-6 mb-1.5"
                : "opacity-0 h-0 mb-0 overflow-hidden"
            }`}
          >
            <dt className="text-green-600">Referral Discount</dt>
            <dd className="text-green-600 font-medium">
              -{formatCurrency(referralDiscountAmount)}
            </dd>
          </div>
          <div
            className={`flex justify-between transition-all duration-200 ease-out ${
              useCreditsAmount > 0 ? "opacity-100 h-6 mb-1.5" : "opacity-0 h-0 mb-0 overflow-hidden"
            }`}
          >
            <dt className="text-blue-600">Booking Credits</dt>
            <dd className="text-blue-600 font-medium">-{formatCurrency(useCreditsAmount)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>VAT ({vatRate.toFixed(1)}%)</dt>
            <dd className="font-medium">{formatCurrency(vat)}</dd>
          </div>
          {!hideTotal && (
            <>
              <hr className="border-t border-gray-200 my-2" />
              <div className="flex justify-between text-base font-semibold">
                <dt>Total</dt>
                <dd>{formatCurrency(finalTotalCost)}</dd>
              </div>
            </>
          )}
        </dl>
      </div>
    </div>
  );
}
