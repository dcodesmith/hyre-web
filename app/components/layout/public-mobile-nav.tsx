import { Calendar, Gift, Home, LogIn, LogOut, User as UserIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Form, NavLink, useLocation, useNavigation } from "react-router";
import { isLogoutFormAction } from "~/auth/logout-navigation";
import type { User } from "~/auth/user";
import { LEGAL_CONSTANTS } from "~/content/legal";
import { useHeroScroll } from "~/hooks/use-hero-scroll";
import { cn } from "~/lib/utils";

const itemClassName =
  "flex min-w-0 flex-1 touch-manipulation flex-col items-center justify-center px-1 py-2 text-muted-foreground transition-colors motion-reduce:transition-none hover:text-foreground focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

function NavGlyph({ children }: { readonly children: ReactNode }) {
  return <span className="mb-1 flex size-6 items-center justify-center">{children}</span>;
}

export function PublicMobileNav({ user }: { readonly user: User | null }) {
  const { pathname } = useLocation();
  const navigation = useNavigation();
  const hideOnScroll = pathname === "/" || pathname === "/search";
  const { hasScrolled } = useHeroScroll(hideOnScroll);
  const isHidden = hideOnScroll && hasScrolled;
  const isLoggingOut = navigation.formMethod != null && isLogoutFormAction(navigation.formAction);

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
      <div
        className={cn(
          "mx-auto flex min-h-13 items-center justify-around py-2",
          user ? "max-w-full px-4" : "max-w-md px-24",
        )}
      >
        <NavLink
          to="/"
          end
          prefetch="intent"
          className={({ isActive }) => cn(itemClassName, isActive && "font-semibold text-primary")}
        >
          <NavGlyph>
            <Home aria-hidden="true" className="size-4" />
          </NavGlyph>
          <span translate="no" className="max-w-full truncate text-xs font-medium">
            {LEGAL_CONSTANTS.companyName}
          </span>
        </NavLink>
        {user ? (
          <>
            <NavLink
              to="/bookings"
              prefetch="intent"
              className={({ isActive }) =>
                cn(itemClassName, isActive && "font-semibold text-primary")
              }
            >
              <NavGlyph>
                <Calendar aria-hidden="true" className="size-4" />
              </NavGlyph>
              <span className="max-w-full truncate text-xs font-medium">Bookings</span>
            </NavLink>
            <NavLink
              to="/referrals"
              prefetch="intent"
              className={({ isActive }) =>
                cn(itemClassName, isActive && "font-semibold text-primary")
              }
            >
              <NavGlyph>
                <Gift aria-hidden="true" className="size-4" />
              </NavGlyph>
              <span className="max-w-full truncate text-xs font-medium">Referrals</span>
            </NavLink>
            <NavLink
              to="/profile"
              prefetch="intent"
              className={({ isActive }) =>
                cn(itemClassName, isActive && "font-semibold text-primary")
              }
            >
              <NavGlyph>
                <UserIcon aria-hidden="true" className="size-4" />
              </NavGlyph>
              <span className="max-w-full truncate text-xs font-medium">Profile</span>
            </NavLink>
            <Form method="post" action="/logout" className="flex min-w-0 flex-1">
              <button
                type="submit"
                disabled={isLoggingOut}
                aria-label={isLoggingOut ? "Logging out" : "Log out"}
                className={itemClassName}
              >
                <NavGlyph>
                  <LogOut aria-hidden="true" className="size-4" />
                </NavGlyph>
                <span className="max-w-full truncate text-xs font-medium">
                  {isLoggingOut ? "Logging out…" : "Log out"}
                </span>
              </button>
            </Form>
          </>
        ) : (
          <NavLink
            to="/auth"
            prefetch="intent"
            className={({ isActive }) =>
              cn(itemClassName, isActive && "font-semibold text-primary")
            }
          >
            <NavGlyph>
              <LogIn aria-hidden="true" className="size-4" />
            </NavGlyph>
            <span className="max-w-full truncate text-xs font-medium">Log in</span>
          </NavLink>
        )}
      </div>
    </nav>
  );
}
