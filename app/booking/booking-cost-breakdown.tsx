import { Tag } from "lucide-react";

import type { BookingCostDisplay, BookingCostRentalRow } from "~/booking/booking-estimate";
import { BOOKING_TYPE_OPTIONS_MAP, type BookingType } from "~/booking/types";
import { formatCurrency } from "~/money/currency";

function rentalCopy(bookingType: BookingType, units: number) {
  const option = BOOKING_TYPE_OPTIONS_MAP[bookingType];
  const title =
    bookingType === "DAY"
      ? "Same day"
      : bookingType === "FULL_DAY"
        ? "Full day"
        : bookingType === "AIRPORT_PICKUP"
          ? "Airport pickup"
          : option.label;

  return {
    title,
    detail: option.duration === "Pickup" ? null : `(${option.duration}) x ${units}`,
  };
}

function LineAmount({
  value,
  currency,
  compareAt,
}: {
  readonly value: number;
  readonly currency: string;
  readonly compareAt?: number | null;
}) {
  const showCompare = compareAt != null && compareAt > value;

  return (
    <span className="flex items-center justify-end gap-2 font-medium tabular-nums">
      {showCompare ? (
        <span className="text-gray-900 line-through">{formatCurrency(compareAt, currency)}</span>
      ) : null}
      <span className={showCompare ? "text-red-500" : "text-gray-900"}>
        {formatCurrency(value, currency)}
      </span>
    </span>
  );
}

function SimpleRow({
  label,
  value,
  currency,
}: {
  readonly label: string;
  readonly value: number;
  readonly currency: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm leading-6">
      <dt className="text-gray-900">{label}</dt>
      <dd className="font-medium tabular-nums">{formatCurrency(value, currency)}</dd>
    </div>
  );
}

function RentalRow({
  row,
  bookingType,
  currency,
}: {
  readonly row: BookingCostRentalRow;
  readonly bookingType: BookingType;
  readonly currency: string;
}) {
  const copy = rentalCopy(bookingType, row.units);
  const compareAt =
    row.compareAtUnitPrice != null && row.compareAtUnitPrice > row.unitPrice
      ? row.compareAtUnitPrice * row.units
      : null;

  return (
    <div className="flex items-center justify-between gap-3">
      <dt>
        <span className="block text-sm leading-6 text-gray-900">{copy.title}</span>
        {copy.detail ? (
          <span className="block text-xs leading-none text-gray-500">{copy.detail}</span>
        ) : null}
      </dt>
      <dd>
        <LineAmount value={row.total} currency={currency} compareAt={compareAt} />
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
  const subtotal = cost.totalAmount + cost.creditsUsed;

  return (
    <section aria-label="Cost breakdown" className="w-full">
      <h3 className="mb-2 text-sm font-semibold leading-5">Cost Breakdown</h3>
      <dl className="flex flex-col gap-2.5 text-sm text-gray-900">
        {cost.rentalRows.map((row) => (
          <RentalRow key={row.key} row={row} bookingType={bookingType} currency={currency} />
        ))}
        {cost.addons.map((addon) => (
          <SimpleRow
            key={addon.id}
            label={addon.quantity > 1 ? `${addon.name} × ${addon.quantity}` : addon.name}
            value={addon.totalPrice}
            currency={currency}
          />
        ))}
        {cost.fuelUpgradeCost > 0 ? (
          <SimpleRow
            label="Fuel upgrade to full tank"
            value={cost.fuelUpgradeCost}
            currency={currency}
          />
        ) : null}
        {cost.platformFeeAmount > 0 ? (
          <SimpleRow
            label={`Platform Fee (${cost.platformFeeRatePercent.toFixed(1)}%)`}
            value={cost.platformFeeAmount}
            currency={currency}
          />
        ) : null}
        {cost.referralDiscountAmount > 0 ? (
          <div className="flex items-start justify-between gap-3 text-sm leading-6">
            <dt>Referral discount</dt>
            <dd className="font-medium tabular-nums text-emerald-500">
              -{formatCurrency(cost.referralDiscountAmount, currency)}
            </dd>
          </div>
        ) : null}
        <SimpleRow
          label={`VAT (${cost.vatRatePercent.toFixed(1)}%)`}
          value={cost.vatAmount}
          currency={currency}
        />
        {cost.creditsUsed > 0 ? (
          <div className="contents lg:hidden">
            <div className="flex justify-between gap-3 text-sm leading-6">
              <dt>Subtotal</dt>
              <dd className="font-medium tabular-nums">{formatCurrency(subtotal, currency)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm leading-6">
              <dt className="flex items-center gap-1">
                <span className="flex size-5 items-center justify-center rounded-full bg-red-500 text-white">
                  <Tag aria-hidden="true" className="size-3" />
                </span>
                Referral credit
              </dt>
              <dd className="font-medium tabular-nums text-red-500">
                -{formatCurrency(cost.creditsUsed, currency)}
              </dd>
            </div>
          </div>
        ) : null}
      </dl>
      <div className="mt-4 hidden rounded-lg bg-white px-3 py-4 lg:block">
        <dl className="flex flex-col gap-2.5">
          {cost.creditsUsed > 0 ? (
            <>
              <div className="flex justify-between gap-3 text-sm leading-6">
                <dt>Subtotal</dt>
                <dd className="font-medium tabular-nums">{formatCurrency(subtotal, currency)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm leading-6">
                <dt className="flex items-center gap-1">
                  <span className="flex size-5 items-center justify-center rounded-full bg-red-500 text-white">
                    <Tag aria-hidden="true" className="size-3" />
                  </span>
                  Referral credit
                </dt>
                <dd className="font-medium tabular-nums text-red-500">
                  -{formatCurrency(cost.creditsUsed, currency)}
                </dd>
              </div>
            </>
          ) : null}
          <div className="flex items-center justify-between gap-3">
            <dt className="text-sm font-semibold leading-5">Order Total:</dt>
            <dd className="text-base font-semibold leading-6 tabular-nums">
              {formatCurrency(cost.totalAmount, currency)}
            </dd>
          </div>
          {cost.savingsAmount > 0 ? (
            <div className="flex justify-between gap-3 text-sm font-medium leading-none text-emerald-500">
              <dt>You save</dt>
              <dd className="tabular-nums">{formatCurrency(cost.savingsAmount, currency)}</dd>
            </div>
          ) : null}
        </dl>
      </div>
    </section>
  );
}

export function BookingOrderTotal({ cost }: { readonly cost: BookingCostDisplay }) {
  return (
    <div className="w-full rounded-lg bg-white px-3 py-4">
      <dl className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-sm font-semibold leading-5 text-gray-900">Order Total:</dt>
          <dd className="text-base font-semibold leading-6 tabular-nums text-gray-900">
            {formatCurrency(cost.totalAmount, cost.currency)}
          </dd>
        </div>
        {cost.savingsAmount > 0 ? (
          <div className="flex justify-between gap-3 text-sm font-medium leading-none text-emerald-500">
            <dt>You save</dt>
            <dd className="tabular-nums">{formatCurrency(cost.savingsAmount, cost.currency)}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
