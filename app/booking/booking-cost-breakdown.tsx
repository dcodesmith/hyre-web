import type { BookingPricingPreview, BookingPricingSegment } from "~/api/bookings/schema";
import { BOOKING_TYPE_LABELS, type BookingType } from "~/booking/types";
import { Skeleton } from "~/components/ui/skeleton";
import { formatCurrency } from "~/money/currency";

function segmentLabel(segment: BookingPricingSegment, bookingType: BookingType, currency: string) {
  const labels = BOOKING_TYPE_LABELS[bookingType];
  const unit = segment.units === 1 ? labels.singular : labels.plural;
  const price = formatCurrency(segment.unitPrice, currency);
  const text = `${price} × ${segment.units} ${unit}`;

  if (segment.compareAtUnitPrice == null || segment.compareAtUnitPrice <= segment.unitPrice) {
    return text;
  }

  return (
    <span className="tabular-nums">
      <span className="mr-1.5 text-gray-400 line-through" aria-hidden="true">
        {formatCurrency(segment.compareAtUnitPrice, currency)}
      </span>
      <span className="text-primary">{text}</span>
    </span>
  );
}

function MoneyRow({
  label,
  value,
  currency,
  discount = false,
}: {
  readonly label: React.ReactNode;
  readonly value: number;
  readonly currency: string;
  readonly discount?: boolean;
}) {
  return (
    <div className="mb-1.5 flex justify-between gap-2">
      <dt className={discount ? "text-green-700" : "min-w-0 text-gray-600"}>{label}</dt>
      <dd className={discount ? "shrink-0 font-medium text-green-700" : "shrink-0 font-medium"}>
        {discount ? "-" : ""}
        {formatCurrency(value, currency)}
      </dd>
    </div>
  );
}

export function BookingCostBreakdownSkeleton() {
  return (
    <section aria-busy="true" aria-label="Cost breakdown" className="mb-8 w-full lg:mb-0">
      <Skeleton className="mb-2 h-4 w-28" />
      <div className="transform-gpu rounded border border-neutral-200 bg-white p-4 shadow-xl inset-shadow-sm lg:rounded-none lg:border-none lg:bg-transparent lg:px-0 lg:py-0 lg:shadow-none lg:inset-shadow-none">
        <div className="space-y-2">
          {Array.from({ length: 4 }, (_, index) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows
              key={index}
              className="flex justify-between gap-2"
            >
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
          <div className="hidden lg:block">
            <hr className="my-2 border-t border-gray-200" />
            <div className="flex justify-between gap-2">
              <Skeleton className="h-5 w-12" />
              <Skeleton className="h-5 w-20" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function BookingCostBreakdown({
  preview,
  bookingType,
}: {
  readonly preview: BookingPricingPreview;
  readonly bookingType: BookingType;
}) {
  const currency = preview.currency;

  return (
    <section aria-label="Cost breakdown" className="mb-8 w-full lg:mb-0">
      <h3 className="mb-2 text-sm font-semibold">Cost Breakdown</h3>
      <div className="transform-gpu rounded border border-neutral-200 bg-white p-4 shadow-xl inset-shadow-sm lg:rounded-none lg:border-none lg:bg-transparent lg:px-0 lg:py-0 lg:shadow-none lg:inset-shadow-none">
        <dl className="text-sm text-gray-950 transition-all duration-200">
          {preview.segments.map((segment, index) => (
            <MoneyRow
              // biome-ignore lint/suspicious/noArrayIndexKey: API groups deterministic pricing segments
              key={`${segment.kind}-${segment.unitPrice}-${segment.compareAtUnitPrice}-${index}`}
              label={segmentLabel(segment, bookingType, currency)}
              value={segment.total}
              currency={currency}
            />
          ))}
          {preview.securityDetailCost > 0 ? (
            <MoneyRow
              label="Security detail"
              value={preview.securityDetailCost}
              currency={currency}
            />
          ) : null}
          {preview.fuelUpgradeCost > 0 ? (
            <MoneyRow
              label="Fuel upgrade to full tank"
              value={preview.fuelUpgradeCost}
              currency={currency}
            />
          ) : null}
          {preview.platformFeeAmount > 0 ? (
            <MoneyRow
              label={`Platform Fee (${preview.platformFeeRatePercent.toFixed(1)}%)`}
              value={preview.platformFeeAmount}
              currency={currency}
            />
          ) : null}
          {preview.referralDiscountAmount > 0 ? (
            <MoneyRow
              label="Referral discount"
              value={preview.referralDiscountAmount}
              currency={currency}
              discount
            />
          ) : null}
          {preview.creditsUsed > 0 ? (
            <MoneyRow
              label="Booking credits"
              value={preview.creditsUsed}
              currency={currency}
              discount
            />
          ) : null}
          <MoneyRow
            label={`VAT (${preview.vatRatePercent.toFixed(1)}%)`}
            value={preview.vatAmount}
            currency={currency}
          />
          <div className="hidden lg:block">
            <hr className="my-2 border-t border-gray-200" />
            <div className="flex justify-between gap-2 text-base font-semibold">
              <dt className="shrink-0 text-gray-600">Total</dt>
              <dd className="min-w-0 text-right tabular-nums">
                {formatCurrency(preview.totalAmount, currency)}
              </dd>
            </div>
            {preview.savingsAmount > 0 ? (
              <div className="mt-1 flex justify-between gap-2 text-sm text-green-700">
                <dt>You save</dt>
                <dd className="font-medium">{formatCurrency(preview.savingsAmount, currency)}</dd>
              </div>
            ) : null}
          </div>
        </dl>
      </div>
    </section>
  );
}
