import { cn } from "cn";
import { Calendar, Gift, Home, LogIn, User as UserIcon } from "lucide-react";
import type { ReactNode } from "react";
import { NavLink, useLocation } from "react-router";
import type { User } from "~/auth/user";
import { LEGAL_CONSTANTS } from "~/content/legal";
import { useHeroScroll } from "~/hooks/use-hero-scroll";

const itemClassName =
  "flex min-w-0 flex-1 touch-manipulation flex-col items-center justify-center px-1 py-2 text-muted-foreground transition-colors motion-reduce:transition-none hover:text-foreground focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

function NavGlyph({ children }: { readonly children: ReactNode }) {
  return <span className="mb-1 flex size-6 items-center justify-center">{children}</span>;
}

export function mobileNavLinks(signedIn: boolean) {
  return [
    { to: "/", label: LEGAL_CONSTANTS.companyName, icon: Home },
    { to: "/bookings", label: "Bookings", icon: Calendar },
    { to: "/referrals", label: "Referrals", icon: Gift },
    signedIn
      ? { to: "/profile", label: "Profile", icon: UserIcon }
      : { to: "/auth", label: "Login", icon: LogIn },
  ];
}

export function PublicMobileNav({ user }: { readonly user: User | null }) {
  const { pathname } = useLocation();
  const hideOnScroll = pathname === "/" || pathname === "/search";
  const { hasScrolled } = useHeroScroll(hideOnScroll);
  const isHidden = hideOnScroll && hasScrolled;

  return (
    <nav
      data-public-mobile-nav
      aria-label="Primary"
      inert={isHidden}
      className={cn(
        "fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 z-40 rounded-full border border-border/50 bg-background/95 shadow-lg backdrop-blur-md transition-transform duration-300 ease-out md:hidden motion-reduce:transition-none",
        isHidden ? "pointer-events-none translate-y-[calc(100%+2rem)]" : "translate-y-0",
      )}
    >
      <div className="mx-auto flex min-h-13 max-w-full items-center justify-around px-4 py-2">
        {mobileNavLinks(user != null).map((link) => {
          const Icon = link.icon;

          return (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/"}
              prefetch="intent"
              className={({ isActive }) =>
                cn(itemClassName, isActive && "font-semibold text-primary")
              }
            >
              <NavGlyph>
                <Icon aria-hidden="true" className="size-4" />
              </NavGlyph>
              <span
                translate={link.to === "/" ? "no" : undefined}
                className="max-w-full truncate text-xs font-medium"
              >
                {link.label}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
