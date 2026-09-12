import type { BookingCostDisplay, BookingCostRentalRow } from "~/booking/booking-estimate";
import { BOOKING_TYPE_LABELS, type BookingType } from "~/booking/types";
import { formatCurrency } from "~/money/currency";

function rentalLabel(row: BookingCostRentalRow, bookingType: BookingType, currency: string) {
  const labels = BOOKING_TYPE_LABELS[bookingType];
  const unit = row.units === 1 ? labels.singular : labels.plural;
  const price = formatCurrency(row.unitPrice, currency);
  const text = `${price} × ${row.units} ${unit}`;

  if (row.compareAtUnitPrice == null || row.compareAtUnitPrice <= row.unitPrice) {
    return text;
  }

  return (
    <span className="tabular-nums">
      <span className="mr-1.5 text-gray-400 line-through" aria-hidden="true">
        {formatCurrency(row.compareAtUnitPrice, currency)}
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

export function BookingCostBreakdown({
  cost,
  bookingType,
}: {
  readonly cost: BookingCostDisplay;
  readonly bookingType: BookingType;
}) {
  const currency = cost.currency;

  return (
    <section aria-label="Cost breakdown" className="mb-8 w-full lg:mb-0">
      <h3 className="mb-2 text-sm font-semibold">Cost Breakdown</h3>
      <div className="transform-gpu rounded border border-neutral-200 bg-white p-4 shadow-xl inset-shadow-sm lg:rounded-none lg:border-none lg:bg-transparent lg:px-0 lg:py-0 lg:shadow-none lg:inset-shadow-none">
        <dl className="text-sm text-gray-950">
          {cost.rentalRows.map((row) => (
            <MoneyRow
              key={row.key}
              label={rentalLabel(row, bookingType, currency)}
              value={row.total}
              currency={currency}
            />
          ))}
          {cost.addons.map((addon) => (
            <MoneyRow
              key={addon.id}
              label={addon.quantity > 1 ? `${addon.name} × ${addon.quantity}` : addon.name}
              value={addon.totalPrice}
              currency={currency}
            />
          ))}
          {cost.fuelUpgradeCost > 0 ? (
            <MoneyRow
              label="Fuel upgrade to full tank"
              value={cost.fuelUpgradeCost}
              currency={currency}
            />
          ) : null}
          {cost.platformFeeAmount > 0 ? (
            <MoneyRow
              label={`Platform Fee (${cost.platformFeeRatePercent.toFixed(1)}%)`}
              value={cost.platformFeeAmount}
              currency={currency}
            />
          ) : null}
          {cost.referralDiscountAmount > 0 ? (
            <MoneyRow
              label="Referral discount"
              value={cost.referralDiscountAmount}
              currency={currency}
              discount
            />
          ) : null}
          {cost.creditsUsed > 0 ? (
            <MoneyRow
              label="Booking credits"
              value={cost.creditsUsed}
              currency={currency}
              discount
            />
          ) : null}
          <MoneyRow
            label={`VAT (${cost.vatRatePercent.toFixed(1)}%)`}
            value={cost.vatAmount}
            currency={currency}
          />
          <div className="hidden lg:block">
            <hr className="my-2 border-t border-gray-200" />
            <div className="flex justify-between gap-2 text-base font-semibold">
              <dt className="shrink-0 text-gray-600">Total</dt>
              <dd className="min-w-0 text-right tabular-nums">
                {formatCurrency(cost.totalAmount, currency)}
              </dd>
            </div>
            {cost.savingsAmount > 0 ? (
              <div className="mt-1 flex justify-between gap-2 text-sm text-green-700">
                <dt>You save</dt>
                <dd className="font-medium">{formatCurrency(cost.savingsAmount, currency)}</dd>
              </div>
            ) : null}
          </div>
        </dl>
      </div>
    </section>
  );
}
