import { Info } from "lucide-react";

import { Checkbox } from "~/components/ui/checkbox";
import { formatCurrency } from "~/money/currency";

export function BookingCreditsControl({
  availableCredits,
  creditLimit,
  checked,
  onCheckedChange,
}: {
  readonly availableCredits: number;
  readonly creditLimit: number;
  readonly checked: boolean;
  readonly onCheckedChange: (checked: boolean) => void;
}) {
  const usable = formatCurrency(creditLimit);
  const available = formatCurrency(availableCredits);

  return (
    <section
      aria-labelledby="referral-credit-heading"
      className="rounded-lg border border-gray-200 bg-white px-4 py-6 shadow-[0_4px_20px_rgba(0,0,0,0.07)] lg:px-6"
    >
      <div className="mb-4 flex items-center gap-2">
        <h3
          id="referral-credit-heading"
          className="text-base font-semibold leading-5 text-gray-900"
        >
          Apply Referral Credit
        </h3>
        <button
          type="button"
          className="rounded-full text-gray-400 hover:text-gray-600 focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-label={`Your available credit is ${available}. You can use ${usable} for this booking.`}
        >
          <Info aria-hidden="true" className="size-4" />
        </button>
      </div>
      <label htmlFor="apply-referral-credit" className="flex cursor-pointer items-start gap-3">
        <Checkbox
          id="apply-referral-credit"
          checked={checked}
          className="mt-0.5"
          onCheckedChange={(value) => onCheckedChange(value === true)}
        />
        <span className="flex min-w-0 flex-1 items-start justify-between gap-3 text-sm leading-5">
          <span className="min-w-0">
            <span className="block font-medium text-gray-900">Referral credit</span>
            <span className="mt-0.5 block text-green-600 tabular-nums">
              {usable} available to use
            </span>
          </span>
          <span className="shrink-0 font-medium tabular-nums text-gray-900">{available}</span>
        </span>
      </label>
    </section>
  );
}
