import { Link, useLocation } from "react-router";

import { Button } from "~/components/ui/button";
import { LEGAL_CONSTANTS } from "~/content/legal";
import { useHasScrolled } from "~/hooks/use-has-scrolled";
import { cn } from "~/lib/utils";

export function PublicHeader() {
  const { pathname } = useLocation();
  const isHeroPage = pathname === "/";
  const hasScrolled = useHasScrolled(isHeroPage);

  const isTransparent = isHeroPage && !hasScrolled;

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 hidden h-17.25 items-center justify-between px-4 transition-[background-color,border-color,box-shadow] duration-300 md:flex",
        isTransparent
          ? "border-b border-transparent bg-transparent"
          : "border-b border-gray-200 bg-white shadow-sm",
      )}
    >
      <Link
        to="/"
        translate="no"
        className={cn(
          "font-brand shrink-0 text-2xl font-bold transition-colors duration-300 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:text-3xl",
          isTransparent ? "text-white hover:text-white/80" : "text-gray-900 hover:text-gray-700",
        )}
      >
        {LEGAL_CONSTANTS.companyName}
      </Link>

      <Button
        asChild
        variant="outline"
        size="sm"
        className={cn(
          "h-9 rounded-md px-3 text-sm transition-colors duration-300 active:translate-y-0",
          isTransparent &&
            "border-white/40 bg-white/20 text-white hover:bg-white/30 hover:text-white",
        )}
      >
        <Link to="/auth">Register or Log in</Link>
      </Button>
    </header>
  );
}
