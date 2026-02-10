import { CarApprovalStatus, Status } from "@prisma/client";
import type { MetaFunction } from "@remix-run/node";
import { data } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { Fingerprint, ShieldCheck } from "lucide-react";
import { BookingSearch } from "~/components/BookingSearch";

import logger from "~/lib/logger.server";
import { prisma } from "~/modules/db/db.server";
import { env } from "~/utils/server/env.server";
import { getBatchCarRatings } from "~/services/reviews.server";
import type { AggregatedRatings } from "~/services/reviews.server";

import { lazy, Suspense, useState } from "react";
import { CarCard } from "~/components/CarCard";
import { CarouselSection } from "~/components/CarouselSection";
import { TopBookingCard, filterTopBookings } from "~/components/TopBookingCard";

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
  LocalBusinessSchema,
  ServiceSchema,
  WebSiteSchema,
  FAQSchema,
} from "~/components/seo/StructuredData";
import { useIsMobile } from "~/hooks/use-mobile";
import { getHeroHeightClasses, useHeroScroll } from "~/hooks/useHeroScroll";
import { ServiceTiers, VehicleTypes } from "~/types";
import type { ServiceTier, VehicleType } from "~/types";
import { companyInfo, defaultKeywords, generateMetaTags } from "~/utils/seo";

/** Minimum number of cars needed to show a category */
const MIN_CATEGORY_SIZE = 3;

/** Popular car makes for the "Popular" category */
const POPULAR_MAKES = new Set(["toyota", "honda", "lexus"]);

/**
 * Lightweight car type for homepage display (server-serialization optimization)
 * Only includes fields actually used by CarCard and TopBookingCard components
 */
interface HomePageCar {
  id: string;
  make: string;
  model: string;
  year: number;
  createdAt: string;
  dayRate: number;
  passengerCapacity: number;
  pricingIncludesFuel: boolean;
  vehicleType: VehicleType;
  serviceTier: ServiceTier;
  images: { url: string }[];
}

interface CarCategories {
  suvs: HomePageCar[];
  luxury: HomePageCar[];
  budget: HomePageCar[];
  sedans: HomePageCar[];
  executive: HomePageCar[];
  popular: HomePageCar[];
  allCars: HomePageCar[];
}

/**
 * Categorizes cars into meaningful groups for display
 * Uses database fields (serviceTier, vehicleType) for categorization
 * Single iteration over cars array for better performance (js-combine-iterations)
 */
function categorizeCars(cars: HomePageCar[]): CarCategories {
  const suvs: HomePageCar[] = [];
  const luxury: HomePageCar[] = [];
  const budget: HomePageCar[] = [];
  const sedans: HomePageCar[] = [];
  const executive: HomePageCar[] = [];
  const popular: HomePageCar[] = [];

  for (const car of cars) {
    // SUVs - by vehicleType
    if (car.vehicleType === VehicleTypes.SUV || car.vehicleType === VehicleTypes.LUXURY_SUV) {
      suvs.push(car);
    }
    // Luxury - by serviceTier (LUXURY or ULTRA_LUXURY)
    if (car.serviceTier === ServiceTiers.LUXURY || car.serviceTier === ServiceTiers.ULTRA_LUXURY) {
      luxury.push(car);
    }
    // Budget-Friendly - by STANDARD tier
    if (car.serviceTier === ServiceTiers.STANDARD) {
      budget.push(car);
    }
    // Sedans - by vehicleType
    if (car.vehicleType === VehicleTypes.SEDAN || car.vehicleType === VehicleTypes.LUXURY_SEDAN) {
      sedans.push(car);
    }
    // Executive - by serviceTier
    if (car.serviceTier === ServiceTiers.EXECUTIVE) {
      executive.push(car);
    }
    // Popular - by common makes (Toyota, Honda, Lexus)
    if (POPULAR_MAKES.has(car.make.toLowerCase())) {
      popular.push(car);
    }
  }

  // Only return categories with enough cars
  return {
    suvs: suvs.length >= MIN_CATEGORY_SIZE ? suvs : [],
    luxury: luxury.length >= MIN_CATEGORY_SIZE ? luxury : [],
    budget: budget.length >= MIN_CATEGORY_SIZE ? budget : [],
    sedans: sedans.length >= MIN_CATEGORY_SIZE ? sedans : [],
    executive: executive.length >= MIN_CATEGORY_SIZE ? executive : [],
    popular: popular.length >= MIN_CATEGORY_SIZE ? popular : [],
    allCars: cars,
  };
}

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
  try {
    // Select only fields needed for homepage display (server-serialization)
    const cars = await prisma.car.findMany({
      where: {
        status: { in: [Status.AVAILABLE, Status.BOOKED] },
        approvalStatus: CarApprovalStatus.APPROVED,
        owner: { fleetOwnerStatus: "APPROVED", hasOnboarded: true },
      },
      select: {
        id: true,
        make: true,
        model: true,
        year: true,
        createdAt: true,
        dayRate: true,
        passengerCapacity: true,
        pricingIncludesFuel: true,
        vehicleType: true,
        serviceTier: true,
        images: { select: { url: true }, orderBy: { createdAt: "asc" }, take: 3 },
      },
      orderBy: [{ updatedAt: "desc" }, { dayRate: "asc" }],
      take: 50, // Reduced from 100 - users rarely scroll through all cars
    });

    // Serialize dates for client (Remix handles this automatically for full objects,
    // but with select we need to do it manually)
    const serializedCars: HomePageCar[] = cars.map((car) => ({
      ...car,
      createdAt: car.createdAt.toISOString(),
    }));

    const categories = categorizeCars(serializedCars);

    // Fetch ratings for all cars in a single batch query
    let ratings: Record<string, AggregatedRatings> = {};
    try {
      const carIds = cars.map((car) => car.id);
      ratings = await getBatchCarRatings(carIds);
    } catch (error) {
      // Continue without ratings if there's an error
    }

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
  } catch (error) {
    logger.error(
      "[HOME] Error in loader:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return data(
      {
        categories: {
          suvs: [],
          luxury: [],
          budget: [],
          sedans: [],
          executive: [],
          popular: [],
          allCars: [],
        },
        ratings: {},
        ENV: {
          DOMAIN: env.DOMAIN,
        },
      },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

type LoaderData = {
  categories: CarCategories;
  ratings: Record<string, AggregatedRatings>;
  ENV: {
    DOMAIN: string;
  };
};

const faqData = {
  questions: [
    {
      question: "How do I book a chauffeur service in Lagos?",
      answer:
        "Simply visit our website, select your bookingn type, date, and time, choose your preferred vehicle, and complete the booking. You'll receive instant confirmation.",
    },
    {
      question: "What types of vehicles are available?",
      answer:
        "We offer a wide range of vehicles including standard, economy, budget-friendly, luxury sedans, SUVs, executive cars, and premium vehicles from brands like Toyota, Lexus and Mercedes-Benz.",
    },
    {
      question: "Are your chauffeurs professional and vetted?",
      answer:
        "Yes, all our chauffeurs are professionally trained, background-checked via the fleet owners, and experienced in providing premium transportation services.",
    },
    {
      question: "Do you offer airport pickup services?",
      answer:
        "Yes, we specialize in airport pickups from Murtala Muhammed International Airport (Lagos).",
    },
  ],
};

export default function IndexPage() {
  const { categories, ratings, ENV } = useLoaderData<LoaderData>();

  // Use dayRate for default price display on homepage
  const getRateForDisplay = (car: HomePageCar) => car.dayRate;

  // Filter cars with 4.5+ rating for Top Bookings section
  // const topBookings = filterTopBookings(categories.allCars, ratings);

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
      <div className={`w-full transition-all duration-300 ease-out ${heroContainerClass}`}>
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
              Your Ride, Your Choice
            </h1>
            <p className="text-base md:text-lg text-white/90 text-center max-w-2xl leading-relaxed">
              Comfort. Safety. Professional. Every ride.
            </p>
          </div>

          {/* Search Box - always visible, adapts style on desktop collapse */}
          <div
            className={`w-full transition-all duration-300 space-y-3 ${isDesktopCollapsed ? "max-w-4xl" : "max-w-2xl"}`}
          >
            <BookingSearch isCompact={isDesktopCollapsed} navigateToSearch />

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
      <div className="relative z-0 bg-white py-8 md:py-12 space-y-6">
        {categories.allCars.length ? (
          <div className="space-y-6">
            {/* Category Filter Pills - Link to /search with filters */}
            <div className="max-w-[1400px] mx-auto px-4 md:px-8">
              <div className="flex items-center gap-2 md:gap-3 overflow-x-auto scrollbar-hide">
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

            {/* Top Bookings Section - Cars with 4.5+ rating */}
            {/* {topBookings.length > 0 && (
              <CarouselSection title="Top Rated" id="top-bookings">
                {topBookings.map(({ car, ratings: carRatings }, index) => (
                  <TopBookingCard
                    key={car.id}
                    car={car}
                    priority={index < 3}
                    price={car.dayRate}
                    ratings={carRatings}
                  />
                ))}
              </CarouselSection>
            )} */}

            {/* SUVs Section */}
            {categories.suvs.length > 0 && (
              <CarouselSection title="SUV" id="suvs" href="/search?vehicleType=SUV">
                {categories.suvs.map((car, index) => {
                  return (
                    <CarCard
                      key={car.id}
                      car={car}
                      priority={index < 5}
                      price={getRateForDisplay(car)}
                      showTotal={false}
                      ratings={ratings[car.id]}
                    />
                  );
                })}
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
                    ratings={ratings[car.id]}
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
                    ratings={ratings[car.id]}
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
                    ratings={ratings[car.id]}
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
                    ratings={ratings[car.id]}
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
                    ratings={ratings[car.id]}
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
                  ratings={ratings[car.id]}
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

        {/* FAQ Section */}
        <section className="bg-gray-50 py-12 md:py-16 border-t">
          <div className="max-w-4xl mx-auto px-4 md:px-8">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">
              Frequently Asked Questions
            </h2>
            <Suspense
              fallback={
                <div className="bg-white rounded-lg border p-8 text-center text-gray-500">
                  Loading FAQ...
                </div>
              }
            >
              <LazyAccordion faqData={faqData} />
            </Suspense>
            <div className="text-center mt-6">
              <Link
                to="/faq"
                className="text-gray-900 font-medium hover:underline inline-flex items-center gap-1"
              >
                View all FAQs <span>→</span>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
