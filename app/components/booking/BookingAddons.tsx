import { User } from "@prisma/client";
import { formatCurrency } from "~/lib/utils";
import { AIRPORT_PICKUP_BOOKING_TYPE, BookingType, DAY_BOOKING_TYPE } from "../bookingTypes";
import { Checkbox } from "../ui/checkbox";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";

interface BookingCredits {
  availableCredits: number;
  totalEarned: number;
  maxCreditsPerBooking: number;
}

interface BookingAddonsProps {
  readonly bookingType: BookingType;
  readonly totalDays: number;
  readonly fuelNote: string | null;
  readonly fuelUpgradeRate: number;
  readonly requiresFullTank: boolean;
  readonly onFullTankChange: (checked: boolean) => void;
  readonly user: User | null;
  readonly bookingCredits: BookingCredits | null;
  readonly useCreditsAmount: number;
  readonly subtotalBeforeDiscounts: number;
  readonly referralDiscountAmount: number;
  readonly onUseCreditsChange: (checked: boolean, bookingCredits: BookingCredits) => void;
  readonly pricingIncludesFuel: boolean;
}

export function BookingAddons({
  bookingType,
  totalDays,
  fuelNote,
  fuelUpgradeRate,
  requiresFullTank,
  onFullTankChange,
  user,
  bookingCredits,
  useCreditsAmount,
  subtotalBeforeDiscounts,
  referralDiscountAmount,
  onUseCreditsChange,
  pricingIncludesFuel,
}: BookingAddonsProps) {
  return (
    <>
      {fuelNote && !pricingIncludesFuel && bookingType !== AIRPORT_PICKUP_BOOKING_TYPE && (
        <div className="bg-slate-100 rounded-md p-2 text-sm text-orange-600 min-w-0">
          <span className="font-medium mr-1">Fuel included:</span>
          <span>{fuelNote}</span>
        </div>
      )}

      {/* Fuel upgrade option - only show for 1-2 DAY bookings and when fuel is not included */}
      {!pricingIncludesFuel &&
        totalDays > 0 &&
        totalDays <= 2 &&
        bookingType === DAY_BOOKING_TYPE && (
          <div className="space-y-1">
            <Label className="flex items-center space-x-2 cursor-pointer">
              <Checkbox
                id="requiresFullTank"
                checked={requiresFullTank}
                onCheckedChange={onFullTankChange}
              />
              <span className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Upgrade to full tank (+{formatCurrency(fuelUpgradeRate)})
              </span>
            </Label>
          </div>
        )}

      {/* <div className="space-y-1">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="includeSecurityDetail"
            checked={includeSecurityDetail}
            onCheckedChange={onSecurityDetailChange}
          />
          <Label htmlFor="includeSecurityDetail" className="cursor-pointer">
            Add security detail (+{formatCurrency(securityDetailRate)} /{" "}
            {BOOKING_TYPE_LABELS[bookingType].perUnit})
          </Label>
        </div>
      </div> */}

      {/* Booking Credits Section */}
      {user && bookingCredits && bookingCredits.availableCredits > 0 && (
        <div className="space-y-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-blue-800">
              Available Credit: {formatCurrency(bookingCredits.availableCredits)}
            </div>
            {bookingCredits.availableCredits > bookingCredits.maxCreditsPerBooking && (
              <span className="text-xs text-blue-600">
                (Max per booking: {formatCurrency(bookingCredits.maxCreditsPerBooking)})
              </span>
            )}
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-blue-200">
            <Label
              htmlFor="applyCredits"
              className="text-sm text-blue-700 cursor-pointer font-bold"
            >
              Apply{" "}
              {formatCurrency(
                Math.min(
                  bookingCredits.availableCredits,
                  Math.max(0, subtotalBeforeDiscounts - referralDiscountAmount),
                  bookingCredits.maxCreditsPerBooking,
                ),
              )}{" "}
              credit
            </Label>
            <Switch
              id="applyCredits"
              checked={useCreditsAmount > 0}
              onCheckedChange={(checked) => onUseCreditsChange(checked, bookingCredits)}
              disabled={bookingCredits.availableCredits === 0}
            />
          </div>
        </div>
      )}
    </>
  );
}
