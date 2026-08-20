import { Link, useNavigate } from "react-router";

import type { PublicCarDetail } from "~/api/cars/schema";
import type { CarReviewsResponse } from "~/api/reviews/schema";
import {
  buildCarDetailSearchPath,
  type CarDetailUrlQuery,
  DEFAULT_REVIEWS_PAGE,
} from "~/car/car-url";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { ReviewList } from "~/review/review-list";

interface ReviewSheetProps {
  readonly car: Pick<
    PublicCarDetail,
    "id" | "make" | "model" | "year" | "averageRating" | "totalReviews"
  >;
  readonly query: CarDetailUrlQuery;
  readonly reviews: CarReviewsResponse;
}

const STAR_LEVELS = [5, 4, 3, 2, 1] as const;

export function ReviewSheet({ car, query, reviews }: ReviewSheetProps) {
  const navigate = useNavigate();
  const ratings = reviews.ratings;
  const totalReviews = ratings?.totalReviews ?? (reviews.pagination.total || car.totalReviews);
  const averageRating = ratings?.averageRating ?? car.averageRating;
  const roundedRating = averageRating.toFixed(1);

  const closeReviews = () => {
    navigate(
      buildCarDetailSearchPath(car, {
        ...query,
        reviewsOpen: false,
        reviewsPage: DEFAULT_REVIEWS_PAGE,
      }),
      { replace: true, preventScrollReset: true },
    );
  };

  const ratingBreakdown = STAR_LEVELS.map((stars) => {
    const count = ratings?.ratingDistribution[stars] ?? 0;
    const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;

    return { stars, count, percentage };
  });

  return (
    <Dialog
      open={query.reviewsOpen}
      onOpenChange={(open) => {
        if (!open) {
          closeReviews();
        }
      }}
    >
      <DialogContent
        showCloseButton
        className="top-auto bottom-0 left-1/2 max-h-[92vh] w-full max-w-5xl translate-x-[-50%] translate-y-0 overflow-y-auto rounded-t-3xl sm:max-w-5xl"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <span aria-hidden="true">&#9733;</span>
            <span>{roundedRating}</span>
          </DialogTitle>
          <DialogDescription>
            {totalReviews} {totalReviews === 1 ? "review" : "reviews"} for {car.make} {car.model}
          </DialogDescription>
        </DialogHeader>

        <div className="lg:grid lg:grid-cols-[280px_1fr] lg:gap-12">
          <div className="mb-4 lg:mb-0">
            <p className="mb-3 text-base font-semibold text-gray-900">Overall rating</p>
            <div className="flex flex-col gap-2">
              {ratingBreakdown.map(({ stars, count, percentage }) => (
                <div key={stars} className="flex items-center gap-3">
                  <span className="w-3 text-sm text-gray-700">{stars}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200">
                    <div className="h-full bg-gray-900" style={{ width: `${percentage}%` }} />
                  </div>
                  <span className="w-6 text-right text-sm text-gray-600">{count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-medium">
              {totalReviews} {totalReviews === 1 ? "review" : "reviews"}
            </h3>
            <ReviewList reviews={reviews.reviews} />
            {reviews.pagination.totalPages > 1 ? (
              <div className="flex items-center justify-between gap-3">
                {reviews.pagination.hasPreviousPage ? (
                  <Button variant="outline" size="sm" asChild>
                    <Link
                      to={buildCarDetailSearchPath(car, {
                        ...query,
                        reviewsOpen: true,
                        reviewsPage: query.reviewsPage - 1,
                      })}
                      preventScrollReset
                    >
                      Previous reviews
                    </Link>
                  </Button>
                ) : (
                  <span />
                )}
                {reviews.pagination.hasNextPage ? (
                  <Button variant="outline" size="sm" asChild>
                    <Link
                      to={buildCarDetailSearchPath(car, {
                        ...query,
                        reviewsOpen: true,
                        reviewsPage: query.reviewsPage + 1,
                      })}
                      preventScrollReset
                    >
                      Next reviews
                    </Link>
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
