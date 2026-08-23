import { useLocation } from "react-router";

import { UserNav } from "~/auth/user-nav";
import { BrandLink, brandBarClassName } from "~/components/layout/brand-link";
import { useHeroScroll } from "~/hooks/use-hero-scroll";
import { cn } from "~/lib/utils";
import { SearchForm } from "~/search/search-form";

export function PublicHeader({ user }: { readonly user: boolean }) {
  const { pathname } = useLocation();
  const isHeroPage = pathname === "/";
  const { hasScrolled } = useHeroScroll(isHeroPage);
  const isTransparent = isHeroPage && !hasScrolled;
  const showCompactSearch = isHeroPage && hasScrolled;

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 hidden justify-between transition-all duration-300 md:flex",
        showCompactSearch ? "items-start px-4 py-4" : brandBarClassName,
        isTransparent
          ? "border-b border-transparent bg-transparent"
          : "border-b border-gray-200 bg-white shadow-sm",
      )}
    >
      <BrandLink
        className={cn(
          "transition-colors duration-300",
          isTransparent ? "text-white hover:text-white/80" : "text-gray-900 hover:text-gray-700",
        )}
      />

      {showCompactSearch ? (
        <div className="mx-4 flex max-w-3xl flex-1 flex-col items-center">
          <div className="w-full">
            <SearchForm isCompact />
          </div>
        </div>
      ) : null}

      <UserNav user={user} isTransparent={isTransparent} />
    </header>
  );
}
