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
  return (
    <section
      aria-labelledby="referral-credit-heading"
      className="mt-4 lg:mt-0 lg:border-t lg:bg-gray-50 lg:px-6 lg:py-4"
    >
      <h3 id="referral-credit-heading" className="mb-2 text-sm font-semibold">
        Referral credit
      </h3>
      <div className="space-y-3 rounded border border-neutral-200 bg-white px-4 py-4 shadow-xl inset-shadow-sm transform-gpu lg:rounded-none lg:border-none lg:bg-transparent lg:px-0 lg:py-0 lg:shadow-none lg:inset-shadow-none">
        <div className="flex items-start gap-3">
          <Checkbox
            id="apply-referral-credit"
            checked={checked}
            className="mt-0.5"
            onCheckedChange={(value) => onCheckedChange(value === true)}
          />
          <label htmlFor="apply-referral-credit" className="min-w-0 flex-1 cursor-pointer">
            <span className="flex justify-between gap-3 text-sm leading-5">
              <span className="min-w-0 wrap-break-words font-medium">Apply referral credit</span>
              <span className="shrink-0 font-medium tabular-nums">
                {formatCurrency(creditLimit)}
              </span>
            </span>
            <span className="mt-0.5 block text-xs leading-4 text-muted-foreground">
              {formatCurrency(availableCredits)} available (Up to {formatCurrency(creditLimit)} can
              be used on this booking)
            </span>
          </label>
        </div>
      </div>
    </section>
  );
}
