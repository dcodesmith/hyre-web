import { Fingerprint, ShieldCheck } from "lucide-react";
import { Suspense, lazy, useState } from "react";
import { Link, type LoaderFunctionArgs, type MetaFunction, useLoaderData } from "react-router";
import { BookingSearch } from "~/components/BookingSearch";
import { FleetShowcaseSections } from "~/components/home/FleetShowcaseSections";
import { getHomePageFleetData } from "~/features/home/homepage-data.server";
import { getHeroHeightClasses } from "~/hooks/useHeroScroll";
import { useRootScrollState } from "~/root";
import { getPublicPartnerBySlug } from "~/services/partners.server";
import { generateMetaTags } from "~/utils/seo";
import { env } from "~/utils/server/env.server";

const CompactSearchBar = lazy(() =>
  import("~/components/CompactSearchBar").then((mod) => ({
    default: mod.CompactSearchBar,
  })),
);

const SearchModal = lazy(() =>
  import("~/components/SearchModal").then((mod) => ({
    default: mod.SearchModal,
  })),
);

const AISearchModal = lazy(() =>
  import("~/components/AISearchModal").then((mod) => ({
    default: mod.AISearchModal,
  })),
);

export const meta: MetaFunction<typeof loader> = ({ loaderData }) => {
  const baseUrl = loaderData?.ENV?.DOMAIN ?? "http://localhost:5173";
  const slug = loaderData?.partner.publicSlug;
  const partnerDisplayName = loaderData?.partner.name ?? (slug ? `@${slug}` : "Partner");
  const count = loaderData?.categories.allCars.length ?? 0;
  const partnerUrl = slug ? `${baseUrl}/partners/${slug}` : `${baseUrl}/partners`;

  return generateMetaTags({
    title: `${partnerDisplayName} Fleet | Tripdly`,
    description: `Browse ${count} verified vehicles from ${partnerDisplayName} on Tripdly.`,
    url: partnerUrl,
    canonical: partnerUrl,
    image: `${baseUrl}/og-image.jpg`,
  });
};

export async function loader({ params }: LoaderFunctionArgs) {
  const slug = params.slug;
  if (!slug) {
    throw new Response("Partner slug is required", { status: 404 });
  }

  const partner = await getPublicPartnerBySlug(slug);
  if (!partner) {
    throw new Response("Partner not found", { status: 404 });
  }

  const { categories, ratings } = await getHomePageFleetData({
    ownerId: partner.id,
    logContext: "PARTNER_PUBLIC",
  });

  return {
    partner,
    categories,
    ratings,
    ENV: {
      DOMAIN: env.DOMAIN,
    },
  };
}

export default function PartnerPublicFleetPage() {
  const { partner, categories, ratings } = useLoaderData<typeof loader>();
  const partnerDisplayName = partner.name ?? `@${partner.publicSlug}`;
  const partnerSearchParams = new URLSearchParams({ partner: partner.publicSlug });
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const { hasScrolled, isMobile } = useRootScrollState();
  const isDesktop = !isMobile;
  const isDesktopCollapsed = isDesktop && hasScrolled;
  const isMobileScrolled = isMobile && hasScrolled;
  const heroScrollState = { isDesktopCollapsed, isMobileScrolled };
  const {
    desktopHeight,
    containerClass: heroContainerClass,
    heroOpacity,
    contentTransform,
  } = getHeroHeightClasses(heroScrollState);

  return (
    <div className="w-full">
      {isMobileScrolled && (
        <div className="md:hidden fixed top-0 left-0 right-0 z-50 px-4 py-3 bg-white border-b border-gray-200 shadow-md">
          <Suspense fallback={null}>
            <CompactSearchBar onClick={() => setIsSearchModalOpen(true)} />
          </Suspense>
        </div>
      )}

      {isSearchModalOpen && (
        <Suspense fallback={null}>
          <SearchModal
            isOpen={isSearchModalOpen}
            onClose={() => setIsSearchModalOpen(false)}
            navigateToSearch
            preservedSearchParams={partnerSearchParams}
          />
        </Suspense>
      )}

      <div
        className={`w-full transition-all duration-300 ease-out ${heroContainerClass} ${heroOpacity}`}
      >
        <div
          className={`absolute inset-0 transition-opacity duration-300 ${
            isDesktopCollapsed ? "opacity-0" : "opacity-100"
          }`}
        >
          <picture>
            <source media="(max-width: 767px)" srcSet="/images/hero-640.webp" type="image/webp" />
            <source media="(min-width: 1024px)" srcSet="/images/hero.webp" type="image/webp" />
            <source media="(min-width: 768px)" srcSet="/images/hero-1200.webp" type="image/webp" />
            <img
              src="/images/hero.webp"
              alt={`Professional chauffeur service from ${partnerDisplayName}`}
              className="w-full h-full object-cover"
              width="1024"
              height="540"
              decoding="async"
              fetchPriority="high"
            />
          </picture>
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/60" />
        </div>

        {isDesktop && (
          <div
            className={`absolute inset-0 bg-white border-b border-gray-200 transition-opacity duration-300 ${
              isDesktopCollapsed ? "opacity-100" : "opacity-0"
            }`}
          />
        )}

        <div
          className={`relative z-10 flex flex-col items-center h-full px-4 max-w-4xl mx-auto transition-all duration-300 ${
            isDesktopCollapsed ? "justify-center py-4" : "justify-center pt-16 md:pt-20"
          }`}
        >
          <div
            className={`transition-all duration-300 overflow-hidden ${
              isDesktopCollapsed || isMobileScrolled
                ? "opacity-0 max-h-0 mb-0"
                : "opacity-100 max-h-40 mb-6"
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-white/80 text-center mb-2">
              Partner Fleet
            </p>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white text-center mb-3">
              {partnerDisplayName}
            </h1>
            <p className="text-base md:text-lg text-white/90 text-center max-w-2xl leading-relaxed">
              {partner.carsCount} verified {partner.carsCount === 1 ? "vehicle" : "vehicles"}
              {partner.city ? ` in ${partner.city}` : ""}.
            </p>
          </div>

          <div
            className={`w-full transition-all duration-300 space-y-3 max-w-2xl ${
              isDesktopCollapsed ? "md:opacity-0 md:max-h-0 md:overflow-hidden" : ""
            }`}
          >
            <BookingSearch navigateToSearch preservedSearchParams={partnerSearchParams} />
            <div className="flex justify-center">
              <Suspense fallback={null}>
                <AISearchModal />
              </Suspense>
            </div>
          </div>

          <div
            className={`flex flex-wrap justify-center gap-4 md:gap-6 text-white transition-all duration-300 overflow-hidden ${
              isDesktopCollapsed ? "opacity-0 max-h-0 mt-0" : "opacity-100 max-h-20 mt-6"
            }`}
          >
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 md:h-5 md:w-5 text-green-400" />
              <span>Vetted fleet owners</span>
            </div>
            <div className="flex items-center gap-2">
              <Fingerprint className="h-4 w-4 md:h-5 md:w-5 text-orange-400" />
              <span>Secure booking</span>
            </div>
          </div>
        </div>
      </div>

      <div className={`hidden md:block transition-all duration-300 ${desktopHeight}`} />

      <div className={`transition-transform duration-300 ${contentTransform}`}>
        <FleetShowcaseSections categories={categories} ratings={ratings} />

        <div className="max-w-6xl mx-auto px-4 pb-8">
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/" className="text-sm text-gray-700 underline underline-offset-4">
              Back to Home
            </Link>
            <Link
              to={`/search?${partnerSearchParams.toString()}`}
              className="text-sm text-gray-700 underline underline-offset-4"
            >
              Browse all vehicles
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
