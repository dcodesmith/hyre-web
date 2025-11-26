import { formatCurrency } from "~/lib/utils";
import { BookingType, BOOKING_TYPE_LABELS } from "../bookingTypes";

interface BookingCostBreakdownProps {
  readonly currentCarPrice: number;
  readonly totalDays: number;
  readonly bookingType: BookingType;
  readonly baseTotal: number;
  readonly includeSecurityDetail: boolean;
  readonly securityDetailTotalCost: number;
  readonly fuelUpgradeCost: number;
  readonly platformFee: number;
  readonly platformServiceFeeRate: number;
  readonly referralDiscountAmount: number;
  readonly useCreditsAmount: number;
  readonly vatRate: number;
  readonly vat: number;
  readonly finalTotalCost: number;
}

export function BookingCostBreakdown({
  currentCarPrice,
  totalDays,
  bookingType,
  baseTotal,
  includeSecurityDetail,
  securityDetailTotalCost,
  fuelUpgradeCost,
  platformFee,
  platformServiceFeeRate,
  referralDiscountAmount,
  useCreditsAmount,
  vatRate,
  vat,
  finalTotalCost,
}: BookingCostBreakdownProps) {
  return (
    <div className="w-full">
      <h3 className="text-base font-medium mb-2">Cost Breakdown</h3>
      <dl className="text-sm transition-all duration-200">
        <div className="flex justify-between mb-1.5">
          <dt className="text-gray-600">
            {formatCurrency(currentCarPrice)} &times; {totalDays}
            {` ${
              totalDays === 1
                ? BOOKING_TYPE_LABELS[bookingType].singular
                : BOOKING_TYPE_LABELS[bookingType].plural
            }`}
          </dt>
          <dd className="text-gray-800">{formatCurrency(baseTotal)}</dd>
        </div>
        <div
          className={`flex justify-between transition-all duration-200 ease-out ${
            includeSecurityDetail ? "opacity-100 h-6 mb-1.5" : "opacity-0 h-0 mb-0 overflow-hidden"
          }`}
        >
          <dt className="text-gray-600">
            + Security Detail &times; {totalDays}{" "}
            {totalDays === 1
              ? BOOKING_TYPE_LABELS[bookingType].singular
              : BOOKING_TYPE_LABELS[bookingType].plural}
          </dt>
          <dd className="text-gray-800">{formatCurrency(securityDetailTotalCost)}</dd>
        </div>
        <div
          className={`flex justify-between transition-all duration-200 ease-out ${
            fuelUpgradeCost > 0 ? "opacity-100 h-6 mb-1.5" : "opacity-0 h-0 mb-0 overflow-hidden"
          }`}
        >
          <dt className="text-gray-600">Fuel Upgrade to Full Tank</dt>
          <dd className="text-gray-800">{formatCurrency(fuelUpgradeCost)}</dd>
        </div>
        <div
          className={`flex justify-between transition-all duration-200 ease-out ${
            platformFee > 0 ? "opacity-100 h-6 mb-1.5" : "opacity-0 h-0 mb-0 overflow-hidden"
          }`}
        >
          <dt className="text-gray-600">Platform Fee ({platformServiceFeeRate.toFixed(1)}%)</dt>
          <dd className="text-gray-800">{formatCurrency(platformFee)}</dd>
        </div>
        <div
          className={`flex justify-between transition-all duration-200 ease-out ${
            referralDiscountAmount > 0
              ? "opacity-100 h-6 mb-1.5"
              : "opacity-0 h-0 mb-0 overflow-hidden"
          }`}
        >
          <dt className="text-green-600">Referral Discount</dt>
          <dd className="text-green-600 font-medium">-{formatCurrency(referralDiscountAmount)}</dd>
        </div>
        <div
          className={`flex justify-between transition-all duration-200 ease-out ${
            useCreditsAmount > 0 ? "opacity-100 h-6 mb-1.5" : "opacity-0 h-0 mb-0 overflow-hidden"
          }`}
        >
          <dt className="text-blue-600">Booking Credits</dt>
          <dd className="text-blue-600 font-medium">-{formatCurrency(useCreditsAmount)}</dd>
        </div>
        <div className="flex justify-between mb-1.5">
          <dt className="text-gray-600">VAT ({vatRate.toFixed(1)}%)</dt>
          <dd className="text-gray-800">{formatCurrency(vat)}</dd>
        </div>
        <hr className="border-t border-gray-200 my-2" />
        <div className="flex justify-between text-base font-semibold">
          <dt>Total</dt> <dd>{formatCurrency(finalTotalCost)}</dd>
        </div>
      </dl>
    </div>
  );
}
