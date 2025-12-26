import type { Role, User } from "@prisma/client";
import { Link, useLocation } from "@remix-run/react";
import {
  Calendar,
  Car,
  Gift,
  Home,
  LayoutDashboard,
  LogIn,
  LogOut,
  User as UserIcon,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Form } from "~/components/CSRFForm";
import { NairaIcon } from "~/components/icons/NairaIcon";
import { SCROLL_COLLAPSE_THRESHOLD } from "~/constants/ui";
import { userHasRole } from "~/utils/shared/roles";

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
  const [isHidden, setIsHidden] = useState(false);

  const isHomePage = location.pathname === "/";
  const isSearchPage = location.pathname === "/search";
  const shouldHideOnScroll = isHomePage || isSearchPage;

  // Hide bottom nav on scroll (on home page and search page)
  useEffect(() => {
    if (!shouldHideOnScroll) {
      setIsHidden(false);
      return;
    }

    const handleScroll = () => {
      setIsHidden(window.scrollY > SCROLL_COLLAPSE_THRESHOLD);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [shouldHideOnScroll]);

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

  // Don't show on car details page (booking flow has its own sticky footer)
  if (location.pathname.startsWith("/cars/")) {
    return null;
  }

  // Base container class with scroll-based hide/show transition (floating design)
  const containerClass = `md:hidden fixed left-4 right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] bg-background/95 backdrop-blur-md border border-border/50 rounded-full shadow-lg z-40 transition-transform duration-300 ease-out ${
    isHidden ? "translate-y-[calc(100%+2rem)]" : "translate-y-0"
  }`;

  const isHomeActive = isHomePage;
  const isBookingsActive = location.pathname.startsWith("/bookings");
  const isReferralsActive = location.pathname.startsWith("/referrals");
  const isFleetOwnerActive = location.pathname.startsWith("/fleet-owner");

  if (user) {
    // Authenticated user navigation
    const isFleetOwner = userHasRole(user, "fleetOwner");
    const isOwnerDriver = user.isOwnerDriver;

    // Fleet owner specific routes
    const isDashboardActive = location.pathname === "/fleet-owner";
    const isCarsActive = location.pathname.startsWith("/fleet-owner/cars");
    const isChauffeursActive = location.pathname.startsWith("/fleet-owner/chauffeurs");
    const isFleetBookingsActive = location.pathname.startsWith("/fleet-owner/bookings");
    const isPayoutActive = location.pathname.startsWith("/fleet-owner/payout-transactions");

    // If fleet owner is on fleet-owner routes, show fleet-specific navigation
    if (isFleetOwner && isFleetOwnerActive) {
      return (
        <div className={containerClass}>
          <div className="flex items-center justify-around max-w-full mx-auto px-4 py-2 min-h-[52px]">
            <NavItem
              to="/fleet-owner"
              icon={<LayoutDashboard size={16} />}
              label="Dashboard"
              isActive={isDashboardActive}
            />

            <NavItem
              to="/fleet-owner/cars"
              icon={<Car size={16} />}
              label="Cars"
              isActive={isCarsActive}
            />

            {!isOwnerDriver && (
              <NavItem
                to="/fleet-owner/chauffeurs"
                icon={<Users size={16} />}
                label="Chauffeurs"
                isActive={isChauffeursActive}
              />
            )}

            <NavItem
              to="/fleet-owner/bookings"
              icon={<Calendar size={16} />}
              label="Bookings"
              isActive={isFleetBookingsActive}
            />

            <NavItem
              to="/fleet-owner/payout-transactions"
              icon={<NairaIcon size={16} />}
              label="Payouts"
              isActive={isPayoutActive}
            />

            <NavItem
              icon={<UserIcon size={16} />}
              label="Profile"
              onClick={() => onProfileOpen?.()}
            />
          </div>
        </div>
      );
    }

    // Default navigation for all other users (including fleet owners on non-fleet routes)
    return (
      <div className={containerClass}>
        <div className="flex items-center justify-around max-w-full mx-auto px-4 py-2 min-h-[52px]">
          <NavItem to="/" icon={<Home size={16} />} label={appName} isActive={isHomeActive} />

          <NavItem
            to={isFleetOwner ? "/fleet-owner" : "/bookings"}
            icon={<Calendar size={16} />}
            label={isFleetOwner ? "Dashboard" : "Bookings"}
            isActive={isFleetOwner ? isFleetOwnerActive : isBookingsActive}
          />

          {!isFleetOwner && (
            <NavItem
              to="/referrals"
              icon={<Gift size={16} />}
              label="Referrals"
              isActive={isReferralsActive}
            />
          )}

          <NavItem
            icon={<UserIcon size={16} />}
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
                  <LogOut size={16} />
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
    <div className={containerClass}>
      <div className="flex items-center justify-around max-w-md mx-auto px-24 py-2 min-h-[52px]">
        <NavItem to="/" icon={<Home size={16} />} label={appName} isActive={isHomeActive} />

        <NavItem to="/auth" icon={<LogIn size={16} />} label="Log in" />
      </div>
    </div>
  );
}
