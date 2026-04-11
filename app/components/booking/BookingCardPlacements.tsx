import type { User } from "@prisma/client";
import { useIsMobile } from "~/hooks/use-mobile";
import { GuestDetails } from "./GuestDetails";
import { BookingActions } from "./BookingActions";
import type { GuestFieldsData } from "./booking-card.types";

export function GuestDetailsPlacement({
  guestFields,
  errorRingClasses,
  className,
  showHeading,
  variant,
}: {
  readonly guestFields: GuestFieldsData | null;
  readonly errorRingClasses: string;
  readonly className: string;
  readonly showHeading?: boolean;
  readonly variant: "mobile" | "desktop";
}) {
  const isMobile = useIsMobile();
  const shouldRender = variant === "mobile" ? isMobile : !isMobile;

  if (!guestFields || !shouldRender) return null;

  return (
    <div className={className}>
      {showHeading && <h3 className="text-sm font-semibold mb-2">Guest Details</h3>}
      <GuestDetails
        fields={{
          name: guestFields.nameField,
          email: guestFields.emailField,
          phoneNumber: guestFields.phoneNumberField,
        }}
        errorRingClasses={errorRingClasses}
      />
    </div>
  );
}

export function BookingActionsPlacement({
  user,
  isPending,
  onNavigateToAuth,
}: {
  readonly user: (User & { roles: { name: string }[]; phoneNumber?: string | null }) | null;
  readonly isPending: boolean;
  readonly onNavigateToAuth: () => void;
}) {
  if (user?.roles?.some((role) => ["fleetOwner", "admin", "staff"].includes(role.name))) {
    return null;
  }

  return <BookingActions user={user} isPending={isPending} onNavigateToAuth={onNavigateToAuth} />;
}
