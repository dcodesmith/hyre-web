import type { BookingPromoCompare } from "~/hooks/useBookingPromoCompare";
import { cn, formatCurrency } from "~/lib/utils";

export type PromoBookingTotalVariant = "desktop" | "mobile";

type PromoBookingTotalProps = {
  readonly promoCompare: BookingPromoCompare | null | undefined;
  readonly finalTotalCost: number;
  readonly variant: PromoBookingTotalVariant;
};

/**
 * Shared promo total line: compare-at strike, payable total, optional savings.
 * Keeps desktop (cost breakdown) and mobile (sticky footer) markup in sync.
 */
export function PromoBookingTotal({
  promoCompare,
  finalTotalCost,
  variant,
}: PromoBookingTotalProps) {
  const showStrike = promoCompare?.showTotalStrike;
  const savingsAmount =
    showStrike && promoCompare ? promoCompare.compareAtGrandTotal - finalTotalCost : 0;

  if (!showStrike || !promoCompare) {
    return (
      <span
        className={cn(variant === "mobile" && "text-base font-semibold tabular-nums")}
        aria-label="Payable booking total"
      >
        {formatCurrency(finalTotalCost)}
      </span>
    );
  }

  const strikeClass = cn(
    "text-gray-400 line-through text-sm font-normal mr-2",
    variant === "mobile" && "tabular-nums",
  );
  const payableClass = cn(
    variant === "mobile" && "text-base font-semibold text-primary tabular-nums",
    variant === "desktop" && "text-primary",
  );

  return (
    <span className="flex flex-col items-end gap-0.5">
      <span className={cn(variant === "desktop" && "tabular-nums")}>
        <span className={strikeClass} aria-hidden="true">
          {formatCurrency(promoCompare.compareAtGrandTotal)}
        </span>
        <span className={payableClass} aria-label="Payable booking total">
          {formatCurrency(finalTotalCost)}
        </span>
      </span>
      {savingsAmount > 0 ? (
        <span
          className="text-xs font-medium text-green-600"
          aria-label={`Promotion savings, ${formatCurrency(savingsAmount)}`}
        >
          You save {formatCurrency(savingsAmount)}
        </span>
      ) : null}
    </span>
  );
}
