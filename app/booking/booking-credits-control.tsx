import { WalletCardsIcon } from "lucide-react";
import type { ReferralCreditsData } from "~/booking/use-booking-credits";
import { Switch } from "~/components/ui/switch";
import { formatCurrency } from "~/money/currency";

export function BookingCreditsControl({
  checked,
  data,
  isLoadingBalance,
  isPricingLoading,
  appliedCredits,
  onCheckedChange,
}: {
  readonly checked: boolean;
  readonly data?: ReferralCreditsData;
  readonly isLoadingBalance: boolean;
  readonly isPricingLoading: boolean;
  readonly appliedCredits: number;
  readonly onCheckedChange: (checked: boolean) => void;
}) {
  let detail = "Turn this on to check and apply your banked referral rewards.";

  if (isLoadingBalance) {
    detail = "Checking your available credits…";
  } else if (data?.error) {
    detail = data.error;
  } else if (data && data.availableCredits <= 0) {
    detail = "You do not have booking credits available yet.";
  } else if (checked && isPricingLoading) {
    detail = "Calculating how much credit can be used…";
  } else if (checked && appliedCredits > 0) {
    detail = `${formatCurrency(appliedCredits)} will be applied to this booking.`;
  } else if (data) {
    detail = `Available: ${formatCurrency(data.availableCredits)}. Up to ${formatCurrency(data.maxCreditsPerBooking)} may apply before the booking percentage cap.`;
  }

  const disabled =
    isLoadingBalance ||
    (data != null && !data.error && (data.availableCredits <= 0 || data.maxCreditsPerBooking <= 0));

  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
      <div className="flex min-w-0 gap-3">
        <WalletCardsIcon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-blue-700" />
        <div>
          <label htmlFor="apply-booking-credits" className="font-semibold text-blue-950">
            Use booking credits
          </label>
          <p className="mt-1 text-xs text-blue-800" aria-live="polite">
            {detail}
          </p>
        </div>
      </div>
      <Switch
        id="apply-booking-credits"
        checked={checked && !disabled}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        aria-label="Use booking credits"
      />
    </div>
  );
}
