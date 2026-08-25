import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";

import type { PublicCarDetail } from "~/api/cars/schema";
import type { CarReviewsResponse } from "~/api/reviews/schema";
import { CarBookingCard } from "~/car/car-booking-card";
import { CarGallery } from "~/car/car-gallery";
import { CarInformationFeatures } from "~/car/car-information";
import { buildBackToSearchPath } from "~/car/car-url";
import { DetailStarRating } from "~/car/compact-star-rating";
import { generateCarSlug } from "~/car/paths";
import { ReviewSheet } from "~/review/review-sheet";
import { vehicleTypeLabels } from "~/search/search-url";
import { SITE_ORIGIN } from "~/seo/metadata";
import { BreadcrumbStructuredData, VehicleStructuredData } from "~/seo/structured-data";

interface CarDetailPageProps {
  readonly car: PublicCarDetail;
  readonly reviews: CarReviewsResponse | null;
}

function MobileReviewSummary({
  averageRating,
  totalReviews,
  onOpen,
}: {
  readonly averageRating: number;
  readonly totalReviews: number;
  readonly onOpen: () => void;
}) {
  const roundedRating = averageRating.toFixed(1);

  return (
    <button
      type="button"
      className="w-full pt-4 pb-2 px-4 flex items-center justify-center gap-6"
      aria-label={`${totalReviews} ${totalReviews === 1 ? "review" : "reviews"}`}
      onClick={onOpen}
    >
      <div className="flex flex-col items-center">
        <span className="text-sm text-gray-900 leading-none">{roundedRating}</span>
        <DetailStarRating
          rating={averageRating}
          ariaLabel={`Average rating: ${roundedRating} out of 5 stars`}
        />
      </div>
      <div className="w-px h-8 bg-gray-300" />
      <div className="flex flex-col items-center">
        <span className="text-sm text-gray-900 leading-none">{totalReviews}</span>
        <span className="text-sm text-gray-800 leading-none">
          {totalReviews === 1 ? "Review" : "Reviews"}
        </span>
      </div>
    </button>
  );
}

export function CarDetailPage({ car, reviews }: CarDetailPageProps) {
  const [searchParams] = useSearchParams();
  const [reviewsOpen, setReviewsOpen] = useState(false);
  const images = car.images.map((image) => image.url);
  const carName = `${car.year} ${car.make} ${car.model}`;
  const carUrl = `${SITE_ORIGIN}/cars/${generateCarSlug(car)}`;
  const totalReviews = reviews?.ratings?.totalReviews ?? car.totalReviews;
  const averageRating = reviews?.ratings?.averageRating ?? car.averageRating;
  const canOpenReviews = reviews != null && totalReviews > 0;
  const roundedRating = averageRating.toFixed(1);
  const colorPrefix = car.color ? `${car.color} ` : "";
  const vehicleTypeLabel = vehicleTypeLabels[car.vehicleType];
  const backToSearch = buildBackToSearchPath(searchParams);

  return (
    <>
      <VehicleStructuredData
        name={carName}
        description={`Book a ${colorPrefix}${carName} with professional chauffeur service in Nigeria. ${vehicleTypeLabel} with ${car.passengerCapacity} passenger capacity.`}
        image={car.images[0]?.url ?? `${SITE_ORIGIN}/og-image.jpg`}
        url={carUrl}
        brand={car.make}
        model={car.model}
        year={car.year}
        color={car.color}
        seatingCapacity={car.passengerCapacity}
        vehicleType={vehicleTypeLabel}
        price={car.dayRate}
      />
      <BreadcrumbStructuredData
        items={[
          { name: "Home", url: SITE_ORIGIN },
          { name: "Search", url: `${SITE_ORIGIN}/search` },
          { name: carName, url: carUrl },
        ]}
      />

      <div className="lg:hidden bg-white">
        <div className="relative">
          <CarGallery images={images} carName={carName} priority />
          <Link
            to={backToSearch}
            className="absolute top-4 left-4 z-10 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors"
            aria-label="Back to search results"
          >
            <ArrowLeft aria-hidden="true" className="w-4 h-4" />
          </Link>
        </div>
        {canOpenReviews ? (
          <MobileReviewSummary
            averageRating={averageRating}
            totalReviews={totalReviews}
            onOpen={() => setReviewsOpen(true)}
          />
        ) : null}
      </div>

      <div className="lg:max-w-6xl lg:space-y-4 lg:mx-auto lg:pt-4">
        <div className="gap-2 hidden lg:flex">
          <Link to={backToSearch} className="hover:underline">
            &larr; Back to search results
          </Link>
        </div>
        <h1 className="px-4 lg:px-0 mt-3 lg:mt-0 text-xl sm:text-2xl lg:text-3xl font-bold mb-2 lg:mb-4">
          {car.make} {car.model} - {car.year}
        </h1>

        <div className="lg:grid lg:grid-cols-[3fr_2fr] lg:gap-4">
          <div className="flex flex-col gap-4">
            <div className="hidden lg:block">
              <CarGallery images={images} carName={carName} priority />
              {canOpenReviews ? (
                <div className="mt-2 flex items-center gap-2 text-base text-gray-900">
                  <span className="text-gray-900">&#9733;</span>
                  <span className="font-semibold">{roundedRating}</span>
                  <span className="text-gray-400">&middot;</span>
                  <button
                    type="button"
                    className="underline underline-offset-2 hover:no-underline"
                    onClick={() => setReviewsOpen(true)}
                  >
                    {totalReviews} {totalReviews === 1 ? "review" : "reviews"}
                  </button>
                </div>
              ) : null}
            </div>

            <CarInformationFeatures
              make={car.make}
              model={car.model}
              year={car.year}
              passengerCapacity={car.passengerCapacity}
            />
          </div>

          <div className="px-4 lg:px-0 lg:sticky lg:top-4">
            <CarBookingCard car={car} />
          </div>
        </div>

        {canOpenReviews && reviews ? (
          <ReviewSheet
            key={car.id}
            car={car}
            reviews={reviews}
            open={reviewsOpen}
            onOpenChange={setReviewsOpen}
          />
        ) : null}
      </div>
    </>
  );
}
