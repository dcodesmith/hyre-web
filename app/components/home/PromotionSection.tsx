import { Flame } from "lucide-react";
import { CarCard } from "~/components/CarCard";
import { CarouselSection } from "~/components/CarouselSection";
import type { PromotedCar } from "~/features/home/homepage-data.server";
import type { AggregatedRatings } from "~/services/reviews.server";

interface PromotionSectionProps {
  readonly cars: PromotedCar[];
  readonly ratings: Record<string, AggregatedRatings>;
  readonly carDetailsBasePath?: string;
}

export function PromotionSection({
  cars,
  ratings,
  carDetailsBasePath = "/cars",
}: PromotionSectionProps) {
  if (cars.length === 0) return null;

  return (
    <div className="bg-gradient-to-b from-red-50/60 to-white pt-8 pb-4">
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 mb-3">
        <div className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-red-500" />
          <h2 className="text-lg md:text-xl font-bold">On Sale</h2>
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">
          Limited-time deals from fleet owners
        </p>
      </div>

      <CarouselSection title="" id="promotions">
        {cars.map((car, index) => (
          <CarCard
            key={car.id}
            car={car}
            detailsBasePath={carDetailsBasePath}
            priority={index < 5}
            price={car.dayRate}
            originalPrice={car.originalDayRate}
            isOnPromotion
            promotionLabel={car.promotionLabel}
            showTotal={false}
            ratings={ratings[car.id]}
          />
        ))}
      </CarouselSection>
    </div>
  );
}
