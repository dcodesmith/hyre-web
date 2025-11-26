import { type FieldMetadata } from "@conform-to/react";
import { Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { GuestInfoFields } from "./GuestInfoFields";
import { User } from "@prisma/client";

interface BookingActionsProps {
  readonly user: User | null;
  readonly isPending: boolean;
  readonly fields: {
    name?: FieldMetadata<string>;
    email?: FieldMetadata<string>;
    phoneNumber?: FieldMetadata<string>;
  };
  readonly onNavigateToAuth: () => void;
}

export function BookingActions({ user, isPending, fields, onNavigateToAuth }: BookingActionsProps) {
  return (
    <div className="space-y-4 pt-4 border-t">
      {!user && fields.name && fields.email && fields.phoneNumber && (
        <>
          <h3 className="text-md font-semibold">Guest Details</h3>
          <GuestInfoFields
            nameField={fields.name}
            emailField={fields.email}
            phoneNumberField={fields.phoneNumber}
          />
        </>
      )}

      <div className="flex flex-col space-y-2">
        {!user ? (
          <>
            <Button
              type="submit"
              className="rounded w-full"
              name="intent"
              value="guest"
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Redirecting to payment...
                </>
              ) : (
                "Pay Now as Guest"
              )}
            </Button>
            <div className="flex items-center justify-center text-sm pt-1">
              <span>Have an account?</span>
              <Button
                type="button"
                variant="link"
                className="underline px-1"
                disabled={isPending}
                onClick={onNavigateToAuth}
              >
                Sign in to book
              </Button>
            </div>
          </>
        ) : (
          <Button
            type="submit"
            className="rounded w-full"
            name="intent"
            value="auth"
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Redirecting to payment...
              </>
            ) : (
              "Pay Now"
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
