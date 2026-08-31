import { CreditCard, Download } from "lucide-react";
import { DetailCard, DetailCardBody, DetailCardHeader } from "~/booking/booking-detail-card";
import type { BookingPaymentView } from "~/booking/booking-domain";
import { Button } from "~/components/ui/button";
import { formatCurrency } from "~/money/currency";

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
        <CreditCard className="h-5 w-5 text-blue-600" aria-hidden="true" />
        Payment Summary
      </DetailCardHeader>
      <DetailCardBody>
        <div className="space-y-3">
          {payment.breakdownAvailable ? (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">
                  Net Total ({payment.dayCount} {payment.dayLabel})
                </span>
                <span className="font-medium tabular-nums">{moneyLabel(payment.netTotal)}</span>
              </div>
              {payment.extensionNetTotal > 0 ? (
                <div className="flex justify-between">
                  <span className="text-sm text-slate-600">
                    Extension ({payment.totalExtendedHours} hours)
                  </span>
                  <span className="text-sm font-medium tabular-nums">
                    {moneyLabel(payment.extensionNetTotal)}
                  </span>
                </div>
              ) : null}
              {payment.securityDetailCost > 0 ? (
                <div className="flex justify-between">
                  <span className="text-sm text-slate-600">
                    Security Detail ({payment.dayCount} {payment.dayLabel})
                  </span>
                  <span className="text-sm font-medium tabular-nums">
                    {moneyLabel(payment.securityDetailCost)}
                  </span>
                </div>
              ) : null}
              {payment.fuelUpgradeCost > 0 ? (
                <div className="flex justify-between">
                  <span className="text-sm text-slate-600">Fuel Upgrade</span>
                  <span className="text-sm font-medium tabular-nums">
                    {moneyLabel(payment.fuelUpgradeCost)}
                  </span>
                </div>
              ) : null}
              {payment.referralDiscountAmount > 0 ? (
                <div className="flex justify-between">
                  <span className="text-sm text-green-600">Referral Discount</span>
                  <span className="text-sm font-medium tabular-nums text-green-600">
                    -{moneyLabel(payment.referralDiscountAmount)}
                  </span>
                </div>
              ) : null}
              {payment.referralCreditsUsed > 0 ? (
                <div className="flex justify-between">
                  <span className="text-sm text-green-600">Referral Credits Used</span>
                  <span className="text-sm font-medium tabular-nums text-green-600">
                    -{moneyLabel(payment.referralCreditsUsed)}
                  </span>
                </div>
              ) : null}
              {payment.platformCustomerServiceFeeAmount > 0 ? (
                <div className="flex justify-between">
                  <span className="text-sm text-slate-600">
                    Platform Fee ({payment.platformFeePercent}%)
                  </span>
                  <span className="text-sm font-medium tabular-nums">
                    {moneyLabel(payment.platformCustomerServiceFeeAmount)}
                  </span>
                </div>
              ) : null}
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">VAT ({payment.vatRatePercent}%)</span>
                <span className="text-sm font-medium tabular-nums">
                  {moneyLabel(payment.vatAmount)}
                </span>
              </div>
              <hr className="h-px w-full border-0 bg-border" />
            </>
          ) : null}
          <div className="flex justify-between font-bold">
            <span>Total Amount</span>
            <span className="tabular-nums">{moneyLabel(payment.totalAmount)}</span>
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
