import { CarApprovalStatus, Status } from "@prisma/client";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { data } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { Fingerprint, LocateFixed, ShieldCheck } from "lucide-react";
import { BookingSearch } from "~/components/BookingSearch";

import logger from "~/lib/logger.server";
import { prisma } from "~/modules/db/db.server";

import { useState } from "react";
import { CarCard } from "~/components/CarCard";
import { CarouselSection } from "~/components/CarouselSection";
import { CompactSearchBar } from "~/components/CompactSearchBar";
import { SearchModal } from "~/components/SearchModal";
import { useIsMobile } from "~/hooks/use-mobile";
import { useCarCategories } from "~/hooks/useCarCategories";
import { getHeroHeightClasses, useHeroScroll } from "~/hooks/useHeroScroll";
import type { SerializedCar } from "~/types";

// Preload hero image only for home page - use WebP with responsive fallback
export const links = () => [
  {
    rel: "preload",
    href: "/images/hero.webp",
    as: "image",
    type: "image/webp",
    media: "(min-width: 1024px)",
  },
  {
    rel: "preload",
    href: "/images/hero-1200.webp",
    as: "image",
    type: "image/webp",
    media: "(min-width: 768px) and (max-width: 1023px)",
  },
  { rel: "preload", href: "/images/hero.png", as: "image", type: "image/png" },
];

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const startTime = Date.now();

    // Simple query: fetch approved, available cars for category display
    const cars = await prisma.car.findMany({
      where: {
        status: { in: [Status.AVAILABLE, Status.BOOKED] },
        approvalStatus: CarApprovalStatus.APPROVED,
        owner: { fleetOwnerStatus: "APPROVED", hasOnboarded: true },
      },
      include: {
        owner: { select: { username: true, name: true } },
        images: { select: { url: true }, orderBy: { createdAt: "asc" }, take: 4 },
        documents: {
          select: {
            id: true,
            documentType: true,
            documentUrl: true,
            status: true,
            notes: true,
            userId: true,
            carId: true,
            approvedById: true,
            createdAt: true,
            updatedAt: true,
            approvedAt: true,
          },
          take: 1,
        },
      },
      orderBy: [{ updatedAt: "desc" }, { dayRate: "asc" }],
      take: 100,
    });

    const totalTime = Date.now() - startTime;
    logger.info("[HOME] Cars query completed", { ms: totalTime, count: cars.length });

    return data(
      { cars },
      {
        headers: {
          "Cache-Control": "public, max-age=300, stale-while-revalidate=1800",
          Vary: "Accept-Encoding",
          "X-Total-Time": `${totalTime}ms`,
        },
      },
    );
  } catch (error) {
    logger.error(
      "[HOME] Error in loader:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return data({ cars: [] }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

type LoaderData = {
  cars: SerializedCar[];
};

export default function IndexPage() {
  const { cars } = useLoaderData<LoaderData>();

  // Use extracted hook for car categorization
  // Use dayRate for default price display on homepage
  const getRateForDisplay = (car: SerializedCar) => car.dayRate;
  const categories = useCarCategories(cars, getRateForDisplay);

  // Use the mobile hook for responsive behavior
  const isMobile = useIsMobile();
  const isDesktop = !isMobile;

  // Scroll-based hero collapse behavior
  const heroScrollState = useHeroScroll();
  const { isDesktopCollapsed, isMobileScrolled } = heroScrollState;
  const { desktopHeight, containerClass: heroContainerClass } =
    getHeroHeightClasses(heroScrollState);

  // Mobile search modal state
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  return (
    <div className="w-full">
      {/* Mobile Compact Sticky Search - Shows after scrolling past hero */}
      {isMobileScrolled && (
        <div className="md:hidden fixed top-0 left-0 right-0 z-50 px-4 py-3 bg-white border-b border-gray-200 shadow-md">
          <CompactSearchBar onClick={() => setIsSearchModalOpen(true)} />
        </div>
      )}

      {/* Mobile Search Modal */}
      <SearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        navigateToSearch
      />

      {/* Hero Section - Fixed on desktop, relative on mobile */}
      <div className={`w-full transition-all duration-300 ease-out ${heroContainerClass}`}>
        {/* Hero Image - fades out when collapsed (desktop only) */}
        <div
          className={`absolute inset-0 transition-opacity duration-300 ${
            isDesktopCollapsed ? "opacity-0" : "opacity-100"
          }`}
        >
          <picture>
            <source media="(min-width: 1024px)" srcSet="/images/hero.webp" type="image/webp" />
            <source media="(min-width: 768px)" srcSet="/images/hero-1200.webp" type="image/webp" />
            <source media="(min-width: 1024px)" srcSet="/images/hero.png" type="image/png" />
            <img
              src="/images/hero.png"
              alt="Professional chauffeur service - luxury vehicle ready for hire"
              className="w-full h-full object-cover"
              width="1024"
              height="540"
              decoding="async"
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

        {/* Hero Content */}
        <div
          className={`relative z-10 flex flex-col items-center h-full px-4 max-w-4xl mx-auto transition-all duration-300 ${
            isDesktopCollapsed ? "justify-center py-4" : "justify-center"
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
              Find your perfect ride
            </h1>
            <p className="text-base md:text-lg text-white/90 text-center max-w-2xl leading-relaxed">
              Comfort. Safety. Professional service. Every ride.
            </p>
          </div>

          {/* Search Box - always visible, adapts style on desktop collapse */}
          <div
            className={`w-full transition-all duration-300 ${isDesktopCollapsed ? "max-w-4xl" : "max-w-2xl"}`}
          >
            <BookingSearch isCompact={isDesktopCollapsed} navigateToSearch />
          </div>

          {/* Trust Badges - hide when collapsed on desktop */}
          <div
            className={`flex flex-wrap justify-center gap-4 md:gap-6 text-white transition-all duration-300 overflow-hidden ${
              isDesktopCollapsed ? "opacity-0 max-h-0 mt-0" : "opacity-100 max-h-20 mt-6"
            }`}
          >
            <div className="flex items-center gap-2">
              <LocateFixed className="h-4 w-4 md:h-5 md:w-5 text-blue-400" />
              <span className="text-xs md:text-sm">Real-time tracking</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 md:h-5 md:w-5 text-green-400" />
              <span className="text-xs md:text-sm">Vetted chauffeurs</span>
            </div>
            <div className="flex items-center gap-2">
              <Fingerprint className="h-4 w-4 md:h-5 md:w-5 text-orange-400" />
              <span className="text-xs md:text-sm">Secure booking</span>
            </div>
          </div>
        </div>
      </div>

      {/* Spacer for fixed hero - only needed on desktop (mobile is relative) */}
      <div className={`hidden md:block transition-all duration-300 ${desktopHeight}`} />

      {/* Main Content Container - Scrolls underneath fixed hero */}
      <div className="relative z-0 bg-white py-8 md:py-12">
        {cars.length ? (
          <div className="space-y-8">
            {/* Category Filter Pills - Link to /search with filters */}
            <div className="max-w-[1400px] mx-auto px-4 md:px-8">
              <div className="flex items-center gap-2 md:gap-3 overflow-x-auto scrollbar-hide pb-2">
                {categories.suvs.length > 0 && (
                  <Link
                    to="/search?vehicleType=SUV"
                    className="flex-shrink-0 px-3 md:px-4 py-1.5 md:py-2 rounded-full border border-gray-300 hover:border-gray-900 hover:bg-gray-50 transition-all text-xs md:text-sm font-medium whitespace-nowrap"
                  >
                    SUV ({categories.suvs.length})
                  </Link>
                )}
                {categories.luxury.length > 0 && (
                  <Link
                    to="/search?serviceTier=LUXURY"
                    className="flex-shrink-0 px-3 md:px-4 py-1.5 md:py-2 rounded-full border border-gray-300 hover:border-gray-900 hover:bg-gray-50 transition-all text-xs md:text-sm font-medium whitespace-nowrap"
                  >
                    Luxury ({categories.luxury.length})
                  </Link>
                )}
                {categories.executive.length > 0 && (
                  <Link
                    to="/search?serviceTier=EXECUTIVE"
                    className="flex-shrink-0 px-3 md:px-4 py-1.5 md:py-2 rounded-full border border-gray-300 hover:border-gray-900 hover:bg-gray-50 transition-all text-xs md:text-sm font-medium whitespace-nowrap"
                  >
                    Executive ({categories.executive.length})
                  </Link>
                )}
                {categories.budget.length > 0 && (
                  <Link
                    to="/search?serviceTier=STANDARD"
                    className="flex-shrink-0 px-3 md:px-4 py-1.5 md:py-2 rounded-full border border-gray-300 hover:border-gray-900 hover:bg-gray-50 transition-all text-xs md:text-sm font-medium whitespace-nowrap"
                  >
                    Budget-friendly ({categories.budget.length})
                  </Link>
                )}
                {categories.popular.length > 0 && (
                  <Link
                    to="/search"
                    className="flex-shrink-0 px-3 md:px-4 py-1.5 md:py-2 rounded-full border border-gray-300 hover:border-gray-900 hover:bg-gray-50 transition-all text-xs md:text-sm font-medium whitespace-nowrap"
                  >
                    Popular ({categories.popular.length})
                  </Link>
                )}
                {categories.sedans.length > 0 && (
                  <Link
                    to="/search?vehicleType=SEDAN"
                    className="flex-shrink-0 px-3 md:px-4 py-1.5 md:py-2 rounded-full border border-gray-300 hover:border-gray-900 hover:bg-gray-50 transition-all text-xs md:text-sm font-medium whitespace-nowrap"
                  >
                    Sedans ({categories.sedans.length})
                  </Link>
                )}
              </div>
            </div>

            {/* SUVs Section */}
            {categories.suvs.length > 0 && (
              <CarouselSection title="SUV" id="suvs" href="/search?vehicleType=SUV">
                {categories.suvs.map((car, index) => (
                  <CarCard
                    key={car.id}
                    car={car}
                    priority={index < 5}
                    price={getRateForDisplay(car)}
                    showTotal={false}
                  />
                ))}
              </CarouselSection>
            )}

            {/* Luxury Section */}
            {categories.luxury.length > 0 && (
              <CarouselSection title="Luxury" id="luxury" href="/search?serviceTier=LUXURY">
                {categories.luxury.map((car) => (
                  <CarCard
                    key={car.id}
                    car={car}
                    priority={false}
                    price={getRateForDisplay(car)}
                    showTotal={false}
                  />
                ))}
              </CarouselSection>
            )}

            {/* Executive Section */}
            {categories.executive.length > 0 && (
              <CarouselSection
                title="Executive"
                id="executive"
                href="/search?serviceTier=EXECUTIVE"
              >
                {categories.executive.map((car) => (
                  <CarCard
                    key={car.id}
                    car={car}
                    priority={false}
                    price={getRateForDisplay(car)}
                    showTotal={false}
                  />
                ))}
              </CarouselSection>
            )}

            {/* Budget-Friendly Section */}
            {categories.budget.length > 0 && (
              <CarouselSection
                title="Budget-friendly"
                id="budget"
                href="/search?serviceTier=STANDARD"
              >
                {categories.budget.map((car) => (
                  <CarCard
                    key={car.id}
                    car={car}
                    priority={false}
                    price={getRateForDisplay(car)}
                    showTotal={false}
                  />
                ))}
              </CarouselSection>
            )}

            {/* Popular Section */}
            {categories.popular.length > 0 && (
              <CarouselSection title="Popular" id="popular" href="/search">
                {categories.popular.map((car) => (
                  <CarCard
                    key={car.id}
                    car={car}
                    priority={false}
                    price={getRateForDisplay(car)}
                    showTotal={false}
                  />
                ))}
              </CarouselSection>
            )}

            {/* Sedans Section */}
            {categories.sedans.length > 0 && (
              <CarouselSection title="Sedans" id="sedans" href="/search?vehicleType=SEDAN">
                {categories.sedans.map((car) => (
                  <CarCard
                    key={car.id}
                    car={car}
                    priority={false}
                    price={getRateForDisplay(car)}
                    showTotal={false}
                  />
                ))}
              </CarouselSection>
            )}

            {/* All Vehicles Section - Carousel only (no search results grid) */}
            <CarouselSection title="All vehicles" href="/search">
              {categories.allCars.map((car, index) => (
                <CarCard
                  key={car.id}
                  car={car}
                  priority={index < 5}
                  price={getRateForDisplay(car)}
                  showTotal={false}
                />
              ))}
            </CarouselSection>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
            <div className="text-center py-16">
              <p className="text-xl text-gray-600 mb-4">No cars available at the moment</p>
              <p className="text-gray-500 mb-6">Please check back later for available vehicles</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
