import { Home, LogIn, LogOut } from "lucide-react";
import { Form, NavLink, useNavigation } from "react-router";

import { isLogoutFormAction } from "~/auth/user-nav";
import { LEGAL_CONSTANTS } from "~/content/legal";
import { cn } from "~/lib/utils";

const itemClassName =
  "flex min-w-0 flex-1 touch-manipulation flex-col items-center justify-center px-1 py-2 text-muted-foreground transition-colors motion-reduce:transition-none hover:text-foreground focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export function PublicMobileNav({ user }: { readonly user: boolean }) {
  const navigation = useNavigation();
  const isLoggingOut = navigation.formMethod != null && isLogoutFormAction(navigation.formAction);

  return (
    <nav
      data-public-mobile-nav
      aria-label="Primary"
      className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 z-40 rounded-full border border-border/50 bg-background/95 shadow-lg backdrop-blur-md md:hidden"
    >
      <div className="mx-auto flex min-h-13 max-w-md items-center justify-around px-16 py-2">
        <NavLink
          to="/"
          end
          prefetch="intent"
          className={({ isActive }) => cn(itemClassName, isActive && "font-semibold text-primary")}
        >
          <Home aria-hidden="true" className="mb-1 size-4" />
          <span translate="no" className="max-w-full truncate text-xs font-medium">
            {LEGAL_CONSTANTS.companyName}
          </span>
        </NavLink>
        {user ? (
          <Form method="post" action="/logout" className="flex min-w-0 flex-1">
            <button
              type="submit"
              disabled={isLoggingOut}
              aria-label={isLoggingOut ? "Logging out" : "Log out"}
              className={itemClassName}
            >
              <LogOut aria-hidden="true" className="mb-1 size-4" />
              <span className="max-w-full truncate text-xs font-medium">
                {isLoggingOut ? "Logging out…" : "Log out"}
              </span>
            </button>
          </Form>
        ) : (
          <NavLink
            to="/auth"
            prefetch="intent"
            className={({ isActive }) =>
              cn(itemClassName, isActive && "font-semibold text-primary")
            }
          >
            <LogIn aria-hidden="true" className="mb-1 size-4" />
            <span className="max-w-full truncate text-xs font-medium">Log in</span>
          </NavLink>
        )}
      </div>
    </nav>
  );
}
