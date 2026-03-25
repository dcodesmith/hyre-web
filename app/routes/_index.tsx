import { Fingerprint, ShieldCheck } from "lucide-react";
import { type MetaFunction, data, useLoaderData } from "react-router";
import { BookingSearch } from "~/components/BookingSearch";

import type { AggregatedRatings } from "~/services/reviews.server";
import { env } from "~/utils/server/env.server";

import { Suspense, lazy, useState } from "react";
import { FleetShowcaseSections } from "~/components/home/FleetShowcaseSections";
import { getHomePageFleetData } from "~/features/home/homepage-data.server";

// Lazy-load components that aren't needed for initial render
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
// Lazy-load Accordion components - create wrapper since they're named exports
const LazyAccordion = lazy(() =>
  import("~/components/ui/accordion").then((mod) => ({
    default: ({
      faqData,
    }: {
      faqData: { questions: Array<{ question: string; answer: string }> };
    }) => (
      <mod.Accordion type="single" collapsible className="bg-white rounded-lg border">
        {faqData.questions.map((faq, index) => (
          <mod.AccordionItem
            key={faq.question}
            value={`item-${index}`}
            className="border-b border-gray-200 last:border-0 px-6"
          >
            <mod.AccordionTrigger className="text-left hover:no-underline">
              <span className="font-medium text-gray-900 pr-4">{faq.question}</span>
            </mod.AccordionTrigger>
            <mod.AccordionContent>
              <p className="text-gray-600 leading-relaxed">{faq.answer}</p>
            </mod.AccordionContent>
          </mod.AccordionItem>
        ))}
      </mod.Accordion>
    ),
  })),
);
import {
  FAQSchema,
  LocalBusinessSchema,
  ServiceSchema,
  WebSiteSchema,
} from "~/components/seo/StructuredData";
import { getHeroHeightClasses } from "~/hooks/useHeroScroll";
import { useRootScrollState } from "~/root";
import { faqData, type CarCategories } from "~/features/home/homepage.shared";
import { companyInfo, defaultKeywords, generateMetaTags } from "~/utils/seo";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const baseUrl = data?.ENV?.DOMAIN ?? "http://localhost:5173";

  const title = "Car Rental in Lagos with Driver | Chauffeur Service | Tripdly";

  const description =
    "Book chauffeur-driven cars in Lagos, Nigeria through our platform. Browse vehicles from verified fleet owners—from standard to premium and luxury options. Day trips, airport pickups, and special events. Choose from SUVs, sedans, and executive cars. Safe, reliable, and professional service.";

  return generateMetaTags({
    title,
    description,
    url: baseUrl,
    image: `${baseUrl}/og-image.jpg`,
    keywords: defaultKeywords,
    canonical: baseUrl,
    geoRegion: "NG",
    geoPlacename: "Lagos",
    author: "Tripdly",
  });
};

export const links = () => [
  {
    rel: "preload",
    href: "/images/hero.webp",
    as: "image",
    type: "image/webp",
    media: "(min-width: 1024px)",
    fetchpriority: "high",
  },
  {
    rel: "preload",
    href: "/images/hero-1200.webp",
    as: "image",
    type: "image/webp",
    media: "(min-width: 768px) and (max-width: 1023px)",
    fetchpriority: "high",
  },
  {
    rel: "preload",
    href: "/images/hero-640.webp",
    as: "image",
    type: "image/webp",
    media: "(max-width: 767px)",
    fetchpriority: "high",
  },
];

export async function loader() {
  const { categories, ratings } = await getHomePageFleetData({ logContext: "HOME" });

  return data(
    {
      categories,
      ratings,
      ENV: {
        DOMAIN: env.DOMAIN,
      },
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=1800",
        Vary: "Accept-Encoding",
      },
    },
  );
}

type LoaderData = {
  categories: CarCategories;
  ratings: Record<string, AggregatedRatings>;
  ENV: {
    DOMAIN: string;
  };
};

export default function IndexPage() {
  const { categories, ratings, ENV } = useLoaderData<LoaderData>();

  // Filter cars with 4.5+ rating for Top Bookings section
  // const topBookings = filterTopBookings(categories.allCars, ratings);

  // Get shared scroll state from root to prevent flash
  // Both header and hero now use the same state source
  const { hasScrolled, isMobile } = useRootScrollState();
  const isDesktop = !isMobile;

  // Derive hero collapse state from shared scroll state
  const isDesktopCollapsed = isDesktop && hasScrolled;
  const isMobileScrolled = isMobile && hasScrolled;
  const heroScrollState = { isDesktopCollapsed, isMobileScrolled };
  const {
    desktopHeight,
    containerClass: heroContainerClass,
    heroOpacity,
    contentTransform,
  } = getHeroHeightClasses(heroScrollState);

  // Mobile search modal state
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  // Build base URL for structured data
  const baseUrl = ENV?.DOMAIN ?? "http://localhost:5173";

  return (
    <div className="w-full">
      {/* Structured Data for SEO */}
      <LocalBusinessSchema
        data={{
          ...companyInfo,
          url: baseUrl,
          logo: `${baseUrl}/logo.svg`,
        }}
      />
      <WebSiteSchema
        data={{
          name: "Tripdly",
          url: baseUrl,
          description: companyInfo.description,
          searchUrl: `${baseUrl}/search?q={search_term_string}`,
        }}
      />
      <ServiceSchema
        data={{
          name: "Premium Chauffeur Service",
          description:
            "Professional chauffeur and luxury car hire service for corporate travel, airport transfers, and special occasions in Nigeria.",
          provider: "Tripdly",
          providerUrl: baseUrl,
          serviceType: "Chauffeur Service",
          areaServed: companyInfo.areaServed,
          priceRange: companyInfo.priceRange,
          image: `${baseUrl}/og-image.jpg`,
        }}
      />
      <FAQSchema data={faqData} />
      {/* Mobile Compact Sticky Search - Shows after scrolling past hero */}
      {isMobileScrolled && (
        <div className="md:hidden fixed top-0 left-0 right-0 z-50 px-4 py-3 bg-white border-b border-gray-200 shadow-md">
          <Suspense fallback={null}>
            <CompactSearchBar onClick={() => setIsSearchModalOpen(true)} />
          </Suspense>
        </div>
      )}

      {/* Mobile Search Modal */}
      {isSearchModalOpen && (
        <Suspense fallback={null}>
          <SearchModal
            isOpen={isSearchModalOpen}
            onClose={() => setIsSearchModalOpen(false)}
            navigateToSearch
          />
        </Suspense>
      )}

      {/* Hero Section - Fixed on desktop, relative on mobile */}
      <div
        className={`w-full transition-all duration-300 ease-out ${heroContainerClass} ${heroOpacity}`}
      >
        {/* Hero Image - fades out when collapsed (desktop only) */}
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
              alt="Professional chauffeur service - luxury vehicle ready for hire"
              className="w-full h-full object-cover"
              width="1024"
              height="540"
              decoding="async"
              fetchPriority="high"
            />
          </picture>
          {/* Dark overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/60" />
        </div>

        {/* Collapsed header background (desktop only) */}
        {isDesktop && (
          <div
            className={`absolute inset-0 bg-white border-b border-gray-200 transition-opacity duration-300 ${
              isDesktopCollapsed ? "opacity-100" : "opacity-0"
            }`}
          />
        )}

        {/* Hero Content - pt-16 md:pt-20 adds space for transparent header overlay */}
        <div
          className={`relative z-10 flex flex-col items-center h-full px-4 max-w-4xl mx-auto transition-all duration-300 ${
            isDesktopCollapsed ? "justify-center py-4" : "justify-center pt-16 md:pt-20"
          }`}
        >
          {/* Title & description - hide when scrolled (desktop full collapse, mobile text only) */}
          <div
            className={`transition-all duration-300 overflow-hidden ${
              isDesktopCollapsed || isMobileScrolled
                ? "opacity-0 max-h-0 mb-0"
                : "opacity-100 max-h-40 mb-6"
            }`}
          >
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white text-center mb-3">
              Your Ride, Your Choice
            </h1>
            <p className="text-base md:text-lg text-white/90 text-center max-w-2xl leading-relaxed">
              Comfort. Safety. Professional. Every ride.
            </p>
          </div>

          {/* Search Box - hide on desktop when collapsed (search moves to header) */}
          <div
            className={`w-full transition-all duration-300 space-y-3 max-w-2xl ${
              isDesktopCollapsed ? "md:opacity-0 md:max-h-0 md:overflow-hidden" : ""
            }`}
          >
            <BookingSearch navigateToSearch />

            <div className="flex justify-center">
              <Suspense fallback={null}>
                <AISearchModal />
              </Suspense>
            </div>
          </div>

          {/* Trust Badges - hide when collapsed on desktop */}
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

      {/* Spacer for fixed hero - only needed on desktop (mobile is relative) */}
      <div className={`hidden md:block transition-all duration-300 ${desktopHeight}`} />

      {/* Main Content Container - Scrolls underneath fixed hero */}
      <div className={`transition-transform duration-300 ${contentTransform}`}>
        <FleetShowcaseSections categories={categories} ratings={ratings} />
      </div>
    </div>
  );
}
