import { Calendar, CheckCircle, CreditCard, MapPin, User } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { Separator } from "~/components/ui/separator";
import type { BookingWithRelations } from "~/types";
import { formatCurrency } from "~/lib/utils";
import { createPaymentSummary } from "~/lib/booking-utils";
import { BookingLegTimeline } from "~/components/booking/BookingLegTimeline";

interface BookingDetailsSheetProps {
  readonly booking: BookingWithRelations;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

export function BookingDetailsSheet({ booking, open, onOpenChange }: BookingDetailsSheetProps) {
  const paymentSummary = createPaymentSummary(booking);
  const guestUser = booking.guestUser as { email?: string; phoneNumber?: string } | null;
  const customerName = booking.user?.name || booking.user?.email || guestUser?.email || "Guest";

  const getPaymentStatusClass = () => {
    if (booking.paymentStatus === "REFUNDED") return "bg-blue-100 text-blue-800 border-blue-200";
    if (booking.paymentStatus === "PAID") return "bg-green-100 text-green-800 border-green-200";
    return "bg-yellow-100 text-yellow-800 border-yellow-200";
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-w-md mx-auto w-full overflow-auto max-h-dvh">
        <SheetHeader className="pb-4 pr-12">
          <div className="flex flex-col gap-3">
            <div className="min-w-0">
              <SheetTitle className="text-left text-base font-semibold break-words">
                {booking.car.make} {booking.car.model} - {booking.car.year}
              </SheetTitle>
              <SheetDescription className="text-left mt-1 text-sm break-words">
                Booking Reference: {booking.bookingReference}
              </SheetDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge
                variant="outline"
                className={`text-sm rounded-sm capitalize ${
                  booking.status === "CANCELLED"
                    ? "bg-red-100 text-red-800 border-red-200"
                    : booking.status === "ACTIVE"
                      ? "bg-blue-100 text-blue-800 border-blue-200"
                      : "bg-green-100 text-green-800 border-green-200"
                }`}
              >
                <CheckCircle className="w-3 h-3 mr-1" />
                {booking.status.toLowerCase()}
              </Badge>
              <Badge
                variant="outline"
                className={`text-sm rounded-sm capitalize ${getPaymentStatusClass()}`}
              >
                <CreditCard className="w-3 h-3 mr-1" />
                {booking.paymentStatus.toLowerCase()}
              </Badge>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-6">
          {/* Customer Info */}
          <div className="bg-gradient-to-t from-primary/5 to-card shadow-sm rounded-sm border p-4 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <User className="h-4 w-4" />
              Customer
            </h3>
            <p className="text-sm font-medium">{customerName}</p>
          </div>

          {/* Trip Timeline */}
          <div className="bg-gradient-to-t from-primary/5 to-card shadow-sm rounded-sm border p-4 space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Trip Timeline
            </h3>
            <div className="space-y-6">
              {booking.legs.map((leg, index) => (
                <BookingLegTimeline key={leg.id} leg={leg} index={index} booking={booking} />
              ))}
            </div>
          </div>

          {/* Location Details */}
          <div className="bg-gradient-to-t from-primary/5 to-card shadow-sm rounded-sm border p-4 space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Location Details
            </h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2" />
                <div>
                  <p className="text-sm font-medium text-slate-600">Pickup Location</p>
                  <p className="text-sm font-semibold text-slate-900">{booking.pickupLocation}</p>
                </div>
              </div>
              <Separator />
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-red-500 rounded-full mt-2" />
                <div>
                  <p className="text-sm font-medium text-slate-600">Return Location</p>
                  <p className="text-sm font-semibold text-slate-900">{booking.returnLocation}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Summary */}
          <div className="bg-gradient-to-t from-primary/5 to-card shadow-sm rounded-sm border p-4 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Payment Summary
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">
                  Net Total ({booking.legs.length} {booking.legs.length === 1 ? "day" : "days"})
                </span>
                <span className="font-medium">{formatCurrency(paymentSummary.netTotal)}</span>
              </div>
              {paymentSummary.extensionNetTotal > 0 && (
                <div className="flex justify-between">
                  <span className="text-sm text-slate-600">
                    Extension ({paymentSummary.totalExtendedHours} hours)
                  </span>
                  <span className="text-sm font-medium">
                    {formatCurrency(paymentSummary.extensionNetTotal)}
                  </span>
                </div>
              )}
              {Number(booking.securityDetailCost ?? 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-sm text-slate-600">
                    Security Detail ({booking.legs.length}{" "}
                    {booking.legs.length === 1 ? "day" : "days"})
                  </span>
                  <span className="text-sm font-medium">
                    {formatCurrency(Number(booking.securityDetailCost))}
                  </span>
                </div>
              )}
              {paymentSummary.fuelUpgradeCost > 0 && (
                <div className="flex justify-between">
                  <span className="text-sm text-slate-600">Fuel Upgrade</span>
                  <span className="text-sm font-medium">
                    {formatCurrency(paymentSummary.fuelUpgradeCost)}
                  </span>
                </div>
              )}
              {paymentSummary.referralDiscountAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-sm text-green-600">Referral Discount</span>
                  <span className="text-sm font-medium text-green-600">
                    -{formatCurrency(paymentSummary.referralDiscountAmount)}
                  </span>
                </div>
              )}
              {Number(booking.referralCreditsUsed) > 0 && (
                <div className="flex justify-between">
                  <span className="text-sm text-green-600">Referral Credits Used</span>
                  <span className="text-sm font-medium text-green-600">
                    -{formatCurrency(Number(booking.referralCreditsUsed))}
                  </span>
                </div>
              )}
              {Number(booking.referralCreditsReserved) > 0 && booking.paymentStatus !== "PAID" && (
                <div className="flex justify-between">
                  <span className="text-sm text-orange-600">
                    Referral Credits (Pending Payment)
                  </span>
                  <span className="text-sm font-medium text-orange-600">
                    -{formatCurrency(Number(booking.referralCreditsReserved))}
                  </span>
                </div>
              )}
              {paymentSummary.platformCustomerServiceFeeAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-sm text-slate-600">
                    Platform Fee ({Number(booking.platformCustomerServiceFeeRatePercent)}%)
                  </span>
                  <span className="text-sm font-medium">
                    {formatCurrency(paymentSummary.platformCustomerServiceFeeAmount)}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">
                  VAT ({paymentSummary.vatRatePercent}%)
                </span>
                <span className="text-sm font-medium">
                  {formatCurrency(paymentSummary.vatAmount)}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between font-bold">
                <span>Total Amount</span>
                <span>{formatCurrency(paymentSummary.totalAmount)}</span>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
