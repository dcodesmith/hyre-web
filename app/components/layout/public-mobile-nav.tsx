import { Home, LogIn } from "lucide-react";
import { NavLink } from "react-router";

import { LEGAL_CONSTANTS } from "~/constants/legal";
import { cn } from "~/lib/utils";

const itemClassName =
  "flex min-w-0 flex-1 touch-manipulation flex-col items-center justify-center px-1 py-2 text-muted-foreground transition-colors motion-reduce:transition-none hover:text-foreground focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export function PublicMobileNav() {
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
        <NavLink
          to="/auth"
          prefetch="intent"
          className={({ isActive }) => cn(itemClassName, isActive && "font-semibold text-primary")}
        >
          <LogIn aria-hidden="true" className="mb-1 size-4" />
          <span className="max-w-full truncate text-xs font-medium">Log in</span>
        </NavLink>
      </div>
    </nav>
  );
}
