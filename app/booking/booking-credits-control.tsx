import { Switch } from "~/components/ui/switch";
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
        <p className="text-sm text-gray-600">
          <span className="font-medium text-gray-950">
            {formatCurrency(availableCredits)} available
          </span>{" "}
          (Up to {formatCurrency(creditLimit)} can be used on this booking)
        </p>
        <div className="flex items-center justify-between gap-4">
          <label
            htmlFor="apply-referral-credit"
            className="cursor-pointer text-sm font-medium text-gray-950"
          >
            Apply referral credit
          </label>
          <Switch
            id="apply-referral-credit"
            checked={checked}
            onCheckedChange={onCheckedChange}
            aria-label="Apply referral credit"
          />
        </div>
      </div>
    </section>
  );
}
