import { ArrowRight, ChevronLeft, ChevronRight, Fingerprint, ShieldCheck } from "lucide-react";
import { useRef } from "react";
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
import { HomeSearch } from "~/home/home-search";
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
    <nav aria-label="Vehicle categories" className="overflow-x-auto">
      <div className="flex w-max min-w-full gap-2 pb-1">
        {categories.map((category) => (
          <Link
            key={category.name}
            to={buildCategorySearchPath(category)}
            className="shrink-0 rounded-full border border-gray-300 px-3 py-2 text-xs font-medium text-gray-800 transition-colors hover:border-gray-900 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:px-4 md:text-sm"
          >
            {category.title} ({category.cars.length})
          </Link>
        ))}
      </div>
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
    <section id={id} className="scroll-mt-20">
      <div className="mb-3 flex items-center justify-between gap-4">
        <Link
          to={href}
          className="group inline-flex items-center gap-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <h2 className="text-lg font-semibold text-gray-950 group-hover:underline md:text-xl">
            {title}
          </h2>
          <span className="inline-flex size-8 items-center justify-center rounded-full border bg-white transition-colors group-hover:border-gray-900">
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
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 scrollbar-none md:gap-6 [&::-webkit-scrollbar]:hidden"
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
        className="rounded-xl border border-amber-200 bg-amber-50 px-6 py-10 text-center"
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
      <section className="py-12 text-center">
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
  return (
    <div className="w-full bg-white">
      <HomeStructuredData />

      <section className="relative min-h-135 overflow-hidden bg-gray-950">
        <div className="absolute inset-0">
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

        <div className="relative z-10 mx-auto flex min-h-135 max-w-4xl flex-col items-center justify-center px-4 py-12">
          <h1 className="text-center text-3xl font-bold text-pretty text-white md:text-4xl lg:text-5xl">
            Your Ride, Your Choice
          </h1>
          <p className="mt-3 text-center text-base leading-relaxed text-white/90 md:text-lg">
            Comfort. Safety. Professional. Every ride.
          </p>

          <div className="mt-8 w-full max-w-2xl">
            <HomeSearch />
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-4 text-sm font-medium text-white md:gap-6">
            <span className="inline-flex items-center gap-2">
              <ShieldCheck aria-hidden="true" className="size-5 text-green-400" />
              Vetted fleet owners
            </span>
            <span className="inline-flex items-center gap-2">
              <Fingerprint aria-hidden="true" className="size-5 text-orange-400" />
              Secure booking
            </span>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-350 space-y-8 px-4 py-10 md:space-y-10 md:px-8 md:py-12">
        {fleet ? <CategoryPills categories={fleet.categories} /> : null}
        <FleetSections fleet={fleet} />
      </div>

      <section className="border-t bg-gray-50 py-12 md:py-16">
        <div className="mx-auto max-w-4xl px-4 md:px-8">
          <h2 className="mb-8 text-center text-2xl font-bold text-pretty text-gray-950 md:text-3xl">
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
                  <span className="min-w-0 flex-1 pr-4 font-medium text-gray-900">
                    {item.question}
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <p className="leading-relaxed text-gray-600">{item.answer}</p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <div className="mt-6 text-center">
            <Link to="/faq" className="font-medium text-gray-900 hover:underline">
              View all FAQs <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
