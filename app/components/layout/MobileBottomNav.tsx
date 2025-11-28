import type { Role, User } from "@prisma/client";
import { Link, useLocation } from "@remix-run/react";
import { Calendar, Gift, Home, LogIn, LogOut, User as UserIcon } from "lucide-react";
import { Form } from "~/components/CSRFForm";
import { userHasRole } from "~/utils/client/misc";

type MobileBottomNavProps = {
  readonly user: (User & { roles: Pick<Role, "name">[] }) | null;
  readonly appName: string;
  readonly onProfileOpen?: () => void;
};

type NavItemProps =
  | {
      asChild: true;
      children: React.ReactNode;
      label?: never;
      icon?: never;
      isActive?: never;
      onClick?: never;
      to?: never;
    }
  | {
      to: string;
      icon: React.ReactNode;
      label: string;
      isActive?: boolean;
      onClick?: never;
      children?: never;
      asChild?: never;
    }
  | {
      onClick: () => void;
      icon: React.ReactNode;
      label: string;
      isActive?: boolean;
      children?: never;
      to?: never;
      asChild?: never;
    };

function NavItem({ to, icon, label, isActive, onClick, children }: NavItemProps) {
  if (children) {
    return children;
  }

  const baseClasses = `flex flex-col items-center justify-center py-2 px-1 min-w-0 flex-1 transition-all duration-200 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ring-offset-background ${
    isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
  }`;

  const content = (
    <>
      <div
        className={`w-6 h-6 mb-1 flex items-center justify-center transition-all duration-200 motion-reduce:transition-none motion-reduce:transform-none${
          isActive ? "scale-110" : "scale-100"
        }`}
      >
        {icon}
      </div>
      <span
        className={`text-xs truncate max-w-full transition-all duration-200 ${
          isActive ? "font-semibold" : "font-medium"
        }`}
      >
        {label}
      </span>
    </>
  );

  if (to) {
    return (
      <Link to={to} prefetch="intent" className={baseClasses}>
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${baseClasses} bg-transparent border-none`}
      >
        {content}
      </button>
    );
  }

  return <div className={baseClasses}>{content}</div>;
}

export function MobileBottomNav({ user, appName, onProfileOpen }: MobileBottomNavProps) {
  const location = useLocation();

  // Don't show on admin routes
  if (location.pathname.startsWith("/admin")) {
    return null;
  }

  // Don't show on auth page
  if (location.pathname.startsWith("/auth")) {
    return null;
  }

  // Don't show on logout route
  if (location.pathname.startsWith("/logout")) {
    return null;
  }

  const isHomeActive = location.pathname === "/";
  const isBookingsActive = location.pathname.startsWith("/bookings");
  const isReferralsActive = location.pathname.startsWith("/referrals");
  const isFleetOwnerActive = location.pathname.startsWith("/fleet-owner");

  if (user) {
    // Authenticated user navigation
    const isFleetOwner = userHasRole(user, "fleetOwner");

    return (
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t border-border z-40">
        <div className="flex items-center justify-around max-w-full mx-auto px-2 pb-[env(safe-area-inset-bottom)] min-h-[56px]">
          <NavItem to="/" icon={<Home size={18} />} label={appName} isActive={isHomeActive} />

          <NavItem
            to={isFleetOwner ? "/fleet-owner" : "/bookings"}
            icon={<Calendar size={18} />}
            label={isFleetOwner ? "Dashboard" : "Bookings"}
            isActive={isFleetOwner ? isFleetOwnerActive : isBookingsActive}
          />

          {!isFleetOwner && (
            <NavItem
              to="/referrals"
              icon={<Gift size={18} />}
              label="Referrals"
              isActive={isReferralsActive}
            />
          )}

          <NavItem
            icon={<UserIcon size={18} />}
            label="Profile"
            onClick={() => onProfileOpen?.()}
          />

          <NavItem asChild>
            <Form method="post" action="/logout" className="flex-1 min-w-0">
              <button
                type="submit"
                className="w-full flex flex-col items-center justify-center py-2 px-1 text-muted-foreground hover:text-foreground transition-all duration-200"
              >
                <div className="w-6 h-6 mb-1 flex items-center justify-center transition-all duration-200 scale-100 hover:scale-110">
                  <LogOut size={18} />
                </div>
                <span className="text-xs font-medium truncate max-w-full">Logout</span>
              </button>
            </Form>
          </NavItem>
        </div>
      </div>
    );
  }

  // Unauthenticated user navigation
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t border-border z-40">
      <div className="flex items-center justify-center max-w-md mx-auto px-24 pb-[env(safe-area-inset-bottom)] min-h-[56px]">
        <NavItem to="/" icon={<Home size={18} />} label={appName} isActive={isHomeActive} />

        <NavItem to="/auth" icon={<LogIn size={18} />} label="Log in" />
      </div>
    </div>
  );
}
