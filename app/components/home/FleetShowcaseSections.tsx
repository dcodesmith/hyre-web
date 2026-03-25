import { lazy, Suspense } from "react";
import { Link } from "react-router";
import { CarCard } from "~/components/CarCard";
import { CarouselSection } from "~/components/CarouselSection";
import type { AggregatedRatings } from "~/services/reviews.server";
import type { CarCategories, HomePageCar } from "~/features/home/homepage.shared";
import { faqData } from "~/features/home/homepage.shared";

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

interface FleetShowcaseSectionsProps {
  readonly categories: CarCategories;
  readonly ratings: Record<string, AggregatedRatings>;
}

export function FleetShowcaseSections({ categories, ratings }: FleetShowcaseSectionsProps) {
  const getRateForDisplay = (car: HomePageCar) => car.dayRate;

  return (
    <div className="relative z-0 bg-white py-8 md:py-12 space-y-6">
      {categories.allCars.length ? (
        <div className="space-y-6">
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

          {categories.suvs.length > 0 && (
            <CarouselSection title="SUV" id="suvs" href="/search?vehicleType=SUV">
              {categories.suvs.map((car, index) => (
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
          )}

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

          {categories.executive.length > 0 && (
            <CarouselSection title="Executive" id="executive" href="/search?serviceTier=EXECUTIVE">
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

          {categories.budget.length > 0 && (
            <CarouselSection title="Budget-friendly" id="budget" href="/search?serviceTier=STANDARD">
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
  );
}
