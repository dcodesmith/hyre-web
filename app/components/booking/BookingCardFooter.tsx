import { type FieldMetadata } from "@conform-to/react";
import type { User } from "@prisma/client";
import { Loader2 } from "lucide-react";
import { cn, formatCurrency } from "~/lib/utils";
import { Button } from "../ui/button";
import { GuestInfoFields } from "./GuestInfoFields";

interface BookingCardFooterProps {
  readonly finalTotalCost: number;
  readonly user: (User & { roles: { name: string }[] }) | null;
  readonly isPending: boolean;
  readonly fields: {
    name?: FieldMetadata<string>;
    email?: FieldMetadata<string>;
    phoneNumber?: FieldMetadata<string>;
  };
  readonly onNavigateToAuth: () => void;
  readonly showFetcherError: boolean;
  readonly fetcherError?: string;
}

export function BookingCardFooter({
  finalTotalCost,
  user,
  isPending,
  fields,
  onNavigateToAuth,
  showFetcherError,
  fetcherError,
}: BookingCardFooterProps) {
  const isFleetOwnerOrAdmin = user?.roles?.some((role) =>
    ["fleetOwner", "admin", "staff"].includes(role.name),
  );

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t shadow-[0_-4px_20px_rgba(0,0,0,0.1)] pb-[env(safe-area-inset-bottom)]">
      {/* Error message */}
      {showFetcherError && fetcherError && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-200">
          <p className="text-red-800 text-sm">{fetcherError}</p>
        </div>
      )}

      {/* Guest fields - show inline if not logged in */}
      {!user && fields.name && fields.email && fields.phoneNumber && (
        <div className="px-4 pt-3 pb-2 border-b bg-gray-50">
          <h4 className="text-sm font-semibold mb-2">Guest Details</h4>
          <GuestInfoFields
            nameField={fields.name}
            emailField={fields.email}
            phoneNumberField={fields.phoneNumber}
          />
        </div>
      )}

      {/* Main sticky bar - Total above, Pay button below */}
      <div className="p-4 space-y-3">
        {/* Total row - label on left, value on right */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-600">Total</span>
          <span className="text-base font-semibold">{formatCurrency(finalTotalCost)}</span>
        </div>

        {/* Pay button - full width */}
        {!isFleetOwnerOrAdmin && (
          <div className="space-y-2">
            {user ? (
              <Button
                type="submit"
                size="lg"
                className="w-full rounded-full"
                name="intent"
                value="auth"
                disabled={isPending}
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Pay Now"
                )}
              </Button>
            ) : (
              <>
                <Button
                  type="submit"
                  size="lg"
                  className="w-full rounded-full"
                  name="intent"
                  value="guest"
                  disabled={isPending}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Pay Now"
                  )}
                </Button>
                <button
                  type="button"
                  className={cn(
                    "w-full text-center text-xs text-primary underline",
                    isPending && "opacity-50 cursor-not-allowed",
                  )}
                  onClick={onNavigateToAuth}
                  disabled={isPending}
                >
                  Sign in to book
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
