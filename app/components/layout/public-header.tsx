import { cn } from "cn";
import { useState } from "react";
import { useLocation } from "react-router";
import type { User } from "~/auth/user";
import { UserNav } from "~/auth/user-nav";
import { BrandLink } from "~/components/layout/brand-link";
import { useHeroScroll } from "~/hooks/use-hero-scroll";
import { CompactSearchBar } from "~/search/compact-search-bar";
import { SearchForm } from "~/search/search-form";
import { SearchModal } from "~/search/search-modal";

export function PublicHeader({ user }: { readonly user: User | null }) {
  const { pathname } = useLocation();
  const isHeroPage = pathname === "/";
  const isSearchPage = pathname === "/search";
  const { hasScrolled } = useHeroScroll(isHeroPage);
  const isTransparent = isHeroPage && !hasScrolled;
  const showCompactSearch = isHeroPage && hasScrolled;
  const useScrolledHeaderBackground = showCompactSearch || isSearchPage;
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 hidden justify-between transition-all duration-300 md:flex",
        isSearchPage
          ? "h-[126px] items-center px-10"
          : showCompactSearch
            ? "h-[126px] items-center px-4 py-4"
            : "h-14 items-center px-4 md:h-17.25",
        isTransparent
          ? "border-b border-transparent bg-transparent"
          : useScrolledHeaderBackground
            ? cn("border-b border-gray-200 bg-gray-100", showCompactSearch && "shadow-sm")
            : "border-b border-gray-200 bg-white shadow-sm",
      )}
    >
      <BrandLink
        className={cn(
          "transition-colors duration-300",
          isTransparent ? "text-white hover:text-white/80" : "text-gray-900 hover:text-gray-700",
          isSearchPage && "text-[30px] leading-9 text-black hover:text-black",
        )}
      />

      {isSearchPage ? (
        <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center px-4 lg:px-10">
          <div className="pointer-events-auto w-full max-w-161">
            <SearchForm isCompact preserveFilterParams />
          </div>
        </div>
      ) : null}

      {showCompactSearch ? (
        <div className="mx-4 flex max-w-3xl flex-1 flex-col items-center">
          <div className="w-full lg:hidden">
            <CompactSearchBar onClick={() => setIsSearchModalOpen(true)} />
          </div>
          <div className="hidden w-full lg:block">
            <SearchForm isCompact />
          </div>
        </div>
      ) : null}

      <UserNav
        user={user}
        isTransparent={isTransparent}
        loginLabel={isSearchPage ? "Log in or sign up" : undefined}
        loginClassName={
          isSearchPage
            ? "h-10 rounded-md border-gray-300 px-3.5 text-sm font-medium text-gray-900 shadow-[0_1px_1px_rgba(0,0,0,0.05)]"
            : undefined
        }
      />
      {isSearchModalOpen ? (
        <SearchModal isOpen onClose={() => setIsSearchModalOpen(false)} />
      ) : null}
    </header>
  );
}
