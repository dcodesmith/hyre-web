import { Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { User } from "@prisma/client";
import { useIsProduction } from "~/utils/client/misc";

interface BookingActionsProps {
  readonly user: User | null;
  readonly isPending: boolean;
  readonly onNavigateToAuth: () => void;
}

export function BookingActions({ user, isPending, onNavigateToAuth }: BookingActionsProps) {
  const isProduction = useIsProduction();

  if (isProduction) return null;

  return (
    <div className="flex flex-col space-y-2">
      {user ? (
        <Button
          type="submit"
          className="rounded-full w-full"
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
      ) : (
        <>
          <Button
            type="submit"
            className="rounded-full w-full"
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
      )}
    </div>
  );
}
