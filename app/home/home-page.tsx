import { ArrowRight, ChevronLeft, ChevronRight, Fingerprint, ShieldCheck } from "lucide-react";
import { useRef, useState } from "react";
import { Link } from "react-router";

import type { CarCategoriesResponse, CarCategory, PublicCar } from "~/api/cars/schema";
import { CarDomain } from "~/car/car-domain";
import { buildCategorySearchPath, getCategorySectionId } from "~/car/paths";
import { VehicleCard } from "~/car/vehicle-card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";
import { HOME_FAQ_ITEMS } from "~/content/home";
import { getHeroHeightClasses, useHeroScroll } from "~/hooks/use-hero-scroll";
import { cn } from "~/lib/utils";
import { CompactSearchBar } from "~/search/compact-search-bar";
import { SearchForm } from "~/search/search-form";
import { SearchModal } from "~/search/search-modal";
import { HomeStructuredData } from "~/seo/structured-data";

interface HomePageProps {
  readonly fleet: CarCategoriesResponse | null;
}

interface VehicleSectionProps {
  readonly cars: readonly PublicCar[];
  readonly href: string;
  readonly id?: string;
  readonly priority?: boolean;
  readonly title: string;
}

interface CategoryPillsProps {
  readonly categories: readonly CarCategory[];
}

interface FleetSectionsProps {
  readonly fleet: CarCategoriesResponse | null;
}

function CategoryPills({ categories }: CategoryPillsProps) {
  if (categories.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label="Vehicle categories"
      className="flex items-center gap-2 overflow-x-auto scrollbar-hide md:gap-3"
    >
      {categories.map((category) => (
        <Link
          key={category.name}
          to={buildCategorySearchPath(category)}
          className="shrink-0 rounded-full border border-gray-300 px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors hover:border-gray-900 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none md:px-4 md:py-2 md:text-sm"
        >
          {category.title} ({category.cars.length})
        </Link>
      ))}
    </nav>
  );
}

function VehicleSection({ cars, href, id, priority = false, title }: VehicleSectionProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  if (cars.length === 0) {
    return null;
  }

  const scroll = (direction: "left" | "right") => {
    scrollContainerRef.current?.scrollBy({
      left: direction === "left" ? -280 : 280,
      behavior: "smooth",
    });
  };

  return (
    <section id={id} className="relative mx-auto max-w-350 scroll-mt-20 px-6 md:px-8">
      <div className="mb-2 flex items-center justify-between">
        <Link
          to={href}
          className="group inline-flex items-center gap-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <h2 className="text-lg font-semibold group-hover:underline md:text-xl">{title}</h2>
          <span className="inline-flex size-8 items-center justify-center rounded-full border border-input bg-background p-1.5 transition-colors group-hover:border-gray-900">
            <ArrowRight aria-hidden="true" className="size-4" />
          </span>
        </Link>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => scroll("left")}
            aria-label={`Scroll ${title} vehicles left`}
            className="inline-flex size-8 items-center justify-center rounded-full border bg-white text-gray-700 hover:border-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => scroll("right")}
            aria-label={`Scroll ${title} vehicles right`}
            className="inline-flex size-8 items-center justify-center rounded-full border bg-white text-gray-700 hover:border-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronRight aria-hidden="true" className="size-4" />
          </button>
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth scrollbar-hide md:gap-6"
      >
        {cars.map((car, index) => (
          <VehicleCard key={car.id} car={car} priority={priority && index < 4} />
        ))}
      </div>
    </section>
  );
}

function FleetSections({ fleet }: FleetSectionsProps) {
  if (!fleet) {
    return (
      <section
        aria-labelledby="fleet-unavailable-heading"
        className="mx-auto max-w-7xl rounded-xl border border-amber-200 bg-amber-50 px-4 py-10 text-center md:px-6 lg:px-8"
      >
        <h2 id="fleet-unavailable-heading" className="text-lg font-semibold text-gray-950">
          Vehicles are temporarily unavailable
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Please try again shortly or contact Tripdly support for help with a booking.
        </p>
      </section>
    );
  }

  if (fleet.allCars.length === 0) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-16 text-center md:px-6 lg:px-8">
        <h2 className="text-xl font-semibold text-gray-950">No vehicles available right now</h2>
        <p className="mt-2 text-gray-600">Please check back later for available vehicles.</p>
      </section>
    );
  }

  const onSaleCars = fleet.allCars.filter((car) => CarDomain(car).hasPromotion);

  return (
    <>
      <VehicleSection
        id="on-sale"
        title="On Sale"
        href="/search?dealsOnly=true"
        cars={onSaleCars}
        priority={onSaleCars.length > 0}
      />
      {fleet.categories.map((category, index) => (
        <VehicleSection
          key={category.name}
          id={getCategorySectionId(category)}
          title={category.title}
          href={buildCategorySearchPath(category)}
          cars={category.cars}
          priority={onSaleCars.length === 0 && index === 0}
        />
      ))}
      <VehicleSection
        title="All vehicles"
        href="/search"
        cars={fleet.allCars}
        priority={fleet.categories.length === 0}
      />
    </>
  );
}

export function HomePage({ fleet }: HomePageProps) {
  const { isDesktopCollapsed, isMobileScrolled } = useHeroScroll(true);
  const { containerClass, heroOpacity, desktopHeight, contentTransform } =
    getHeroHeightClasses(isDesktopCollapsed);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  return (
    <div className="w-full bg-white">
      <HomeStructuredData />

      {isMobileScrolled ? (
        <div className="fixed top-0 right-0 left-0 z-50 border-b border-gray-200 bg-white px-4 py-3 shadow-md md:hidden">
          <CompactSearchBar onClick={() => setIsSearchModalOpen(true)} />
        </div>
      ) : null}

      {isSearchModalOpen ? (
        <SearchModal isOpen onClose={() => setIsSearchModalOpen(false)} />
      ) : null}

      <section
        className={cn(
          "w-full overflow-hidden bg-gray-950 transition-[height,opacity,padding] duration-300 ease-out motion-reduce:transition-none",
          containerClass,
          heroOpacity,
        )}
      >
        <div
          className={cn(
            "absolute inset-0 transition-opacity duration-300",
            isDesktopCollapsed ? "opacity-0" : "opacity-100",
          )}
        >
          <picture className="absolute inset-0">
            <source media="(max-width: 767px)" srcSet="/images/hero-640.webp" type="image/webp" />
            <source
              media="(min-width: 768px) and (max-width: 1023px)"
              srcSet="/images/hero-1200.webp"
              type="image/webp"
            />
            <source media="(min-width: 1024px)" srcSet="/images/hero.webp" type="image/webp" />
            <img
              src="/images/hero.webp"
              alt="Professional chauffeur service with a luxury vehicle ready for hire"
              width={1024}
              height={540}
              fetchPriority="high"
              className="size-full object-cover"
            />
          </picture>
          <div className="absolute inset-0 bg-linear-to-b from-black/50 via-black/30 to-black/60" />
        </div>

        <div
          className={cn(
            "pointer-events-none absolute inset-0 hidden border-b border-gray-200 bg-white transition-opacity duration-300 md:block",
            isDesktopCollapsed ? "md:opacity-100" : "md:opacity-0",
          )}
        />

        <div
          className={cn(
            "relative z-10 mx-auto flex h-full max-w-4xl flex-col items-center px-4 transition-[padding] duration-300 motion-reduce:transition-none",
            isDesktopCollapsed ? "justify-center py-4" : "justify-center pt-16 md:pt-20",
          )}
        >
          <div
            className={cn(
              "overflow-hidden transition-[max-height,opacity,margin] duration-300 motion-reduce:transition-none",
              isDesktopCollapsed || isMobileScrolled
                ? "mb-0 max-h-0 opacity-0"
                : "mb-6 max-h-40 opacity-100",
            )}
          >
            <h1 className="mb-3 text-center text-3xl font-bold text-white md:text-4xl lg:text-5xl">
              Your Ride, Your Choice
            </h1>
            <p className="max-w-2xl text-center text-base leading-relaxed text-white/90 md:text-lg">
              Comfort. Safety. Professional. Every ride.
            </p>
          </div>

          <div
            className={cn(
              "w-full max-w-2xl space-y-3 transition-[max-height,opacity] duration-300 motion-reduce:transition-none",
              isDesktopCollapsed && "md:max-h-0 md:overflow-hidden md:opacity-0",
            )}
          >
            <SearchForm />
          </div>

          <div
            className={cn(
              "flex flex-wrap justify-center gap-4 overflow-hidden text-white transition-[max-height,opacity,margin] duration-300 motion-reduce:transition-none md:gap-6",
              isDesktopCollapsed ? "mt-0 max-h-0 opacity-0" : "mt-6 max-h-20 opacity-100",
            )}
          >
            <div className="flex items-center gap-2">
              <ShieldCheck aria-hidden="true" className="size-4 text-green-400 md:size-5" />
              <span>Vetted fleet owners</span>
            </div>
            <div className="flex items-center gap-2">
              <Fingerprint aria-hidden="true" className="size-4 text-orange-400 md:size-5" />
              <span>Secure booking</span>
            </div>
          </div>
        </div>
      </section>
      <div
        className={cn(
          "hidden transition-[height] duration-300 motion-reduce:transition-none md:block",
          desktopHeight,
        )}
      />

      <div className={cn("transition-transform duration-300", contentTransform)}>
        <div className="relative z-0 space-y-6 bg-white pt-8 md:pt-12">
          <div className="space-y-6">
            {fleet && fleet.categories.length > 0 ? (
              <div className="mx-auto max-w-350 px-4 md:px-8">
                <CategoryPills categories={fleet.categories} />
              </div>
            ) : null}
            <FleetSections fleet={fleet} />
          </div>

          <section className="border-t bg-gray-50 py-12 md:py-16">
            <div className="mx-auto max-w-4xl px-4 md:px-8">
              <h2 className="mb-8 text-center text-2xl font-bold md:text-3xl">
                Frequently Asked Questions
              </h2>
              <Accordion type="single" collapsible className="rounded-lg border bg-white">
                {HOME_FAQ_ITEMS.map((item, index) => (
                  <AccordionItem
                    key={item.question}
                    value={`home-faq-${index}`}
                    className="border-b border-gray-200 px-6 last:border-0"
                  >
                    <AccordionTrigger className="text-left hover:no-underline">
                      <span className="pr-4 font-medium text-gray-900">{item.question}</span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <p className="leading-relaxed text-gray-600">{item.answer}</p>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
              <div className="mt-6 text-center">
                <Link
                  to="/faq"
                  className="inline-flex items-center gap-1 font-medium text-gray-900 hover:underline"
                >
                  View all FAQs <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
