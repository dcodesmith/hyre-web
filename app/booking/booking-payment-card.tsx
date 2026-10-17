import { cn } from "cn";
import { CreditCard, Download } from "lucide-react";
import {
  DetailCard,
  DetailCardBody,
  DetailCardHeader,
  DetailCardIcon,
} from "~/booking/booking-detail-card";
import type { BookingPaymentView } from "~/booking/booking-domain";
import { Button } from "~/components/ui/button";
import { formatCurrency } from "~/money/currency";

function PaymentRow({
  label,
  value,
  discount = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly discount?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span
        className={cn(
          "min-w-0 leading-5 font-medium break-words",
          discount ? "text-green-600" : "text-gray-500",
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "shrink-0 leading-6 font-medium tabular-nums",
          discount ? "text-green-600" : "text-gray-900",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function PaymentAddonRows({
  addons,
  moneyLabel,
}: {
  readonly addons: BookingPaymentView["addons"];
  readonly moneyLabel: (value: number) => string;
}) {
  return addons.map((addon) => (
    <PaymentRow
      key={addon.code}
      label={`${addon.name}${addon.quantity > 1 ? ` (${addon.quantity})` : ""}`}
      value={moneyLabel(addon.totalPrice)}
    />
  ));
}

export function BookingPaymentCard({
  payment,
  receiptPath,
}: {
  readonly payment: BookingPaymentView;
  readonly receiptPath?: string;
}) {
  const moneyLabel = (value: number) => formatCurrency(value, payment.currency);

  return (
    <DetailCard>
      <DetailCardHeader>
        <DetailCardIcon>
          <CreditCard aria-hidden="true" />
        </DetailCardIcon>
        Payment Summary
      </DetailCardHeader>
      <DetailCardBody>
        <div className="space-y-3">
          {payment.breakdownAvailable ? (
            <>
              <PaymentRow
                label={`Net Total (${payment.dayCount} ${payment.dayLabel})`}
                value={moneyLabel(payment.netTotal)}
              />
              {payment.extensionNetTotal > 0 ? (
                <PaymentRow
                  label={`Extension (${payment.totalExtendedHours} hours)`}
                  value={moneyLabel(payment.extensionNetTotal)}
                />
              ) : null}
              <PaymentAddonRows addons={payment.addons} moneyLabel={moneyLabel} />
              {payment.fuelUpgradeCost > 0 ? (
                <PaymentRow label="Fuel Upgrade" value={moneyLabel(payment.fuelUpgradeCost)} />
              ) : null}
              {payment.referralDiscountAmount > 0 ? (
                <PaymentRow
                  label="Referral Discount"
                  value={`-${moneyLabel(payment.referralDiscountAmount)}`}
                  discount
                />
              ) : null}
              {payment.referralCreditsUsed > 0 ? (
                <PaymentRow
                  label="Referral Credits Used"
                  value={`-${moneyLabel(payment.referralCreditsUsed)}`}
                  discount
                />
              ) : null}
              {payment.platformCustomerServiceFeeAmount > 0 ? (
                <PaymentRow
                  label={`Platform Fee (${payment.platformFeePercent}%)`}
                  value={moneyLabel(payment.platformCustomerServiceFeeAmount)}
                />
              ) : null}
              <PaymentRow
                label={`VAT (${payment.vatRatePercent}%)`}
                value={moneyLabel(payment.vatAmount)}
              />
            </>
          ) : (
            <PaymentAddonRows addons={payment.addons} moneyLabel={moneyLabel} />
          )}
          <div className="flex items-center justify-between gap-3 border-t border-gray-200 pt-4 text-sm text-gray-900">
            <span className="leading-5 font-semibold">Total Amount</span>
            <span className="leading-6 font-medium tabular-nums">
              {moneyLabel(payment.totalAmount)}
            </span>
          </div>
          {receiptPath ? (
            <Button asChild variant="outline" className="w-full">
              <a href={receiptPath}>
                <Download aria-hidden="true" />
                Download Receipt
              </a>
            </Button>
          ) : null}
        </div>
      </DetailCardBody>
    </DetailCard>
  );
}
