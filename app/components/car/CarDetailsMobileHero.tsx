import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { Link } from "react-router";
import CarCarousel from "~/components/Carousel";
import { StarRating } from "~/components/reviews/StarRating";
import type { AggregatedRatings } from "~/services/reviews.server";

type CarDetailsMobileHeroProps = {
  readonly carImages: string[] | undefined;
  readonly carName: string;
  readonly backToSearch: string;
  readonly ratings: AggregatedRatings;
  readonly roundedRating: string;
  readonly onOpenReviews: () => void;
};

export function CarDetailsMobileHero({
  carImages,
  carName,
  backToSearch,
  ratings,
  roundedRating,
  onOpenReviews,
}: CarDetailsMobileHeroProps) {
  return (
    <div className="lg:hidden bg-white">
      <div className="relative">
        <CarCarousel variant="booking" images={carImages} priority carName={carName} />
        <Link
          to={backToSearch}
          className="absolute top-4 left-4 z-10 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors"
          aria-label="Back to search results"
        >
          <ArrowLeftIcon className="w-4 h-4" />
        </Link>
      </div>
      {ratings.totalReviews > 0 && (
        <button
          type="button"
          className="w-full pt-4 pb-2 px-4 flex items-center justify-center gap-6"
          onClick={onOpenReviews}
        >
          <div className="flex flex-col items-center">
            <span className="text-sm text-gray-900 leading-none">{roundedRating}</span>
            <StarRating rating={ratings.averageRating} size="sm" />
          </div>
          <div className="w-px h-8 bg-gray-300" />
          <div className="flex flex-col items-center">
            <span className="text-sm text-gray-900 leading-none">{ratings.totalReviews}</span>
            <span className="text-sm text-gray-800 leading-none">
              {ratings.totalReviews === 1 ? "Review" : "Reviews"}
            </span>
          </div>
        </button>
      )}
    </div>
  );
}
