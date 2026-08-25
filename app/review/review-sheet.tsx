import { useRef } from "react";
import { useFetcher, useLocation } from "react-router";

import type { PublicCarDetail } from "~/api/cars/schema";
import type { CarReviewsResponse } from "~/api/reviews/schema";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { ReviewList } from "~/review/review-list";

type CarReviewsLoaderData = {
  readonly reviews: CarReviewsResponse | null;
};

interface ReviewSheetProps {
  readonly car: Pick<
    PublicCarDetail,
    "id" | "make" | "model" | "year" | "averageRating" | "totalReviews"
  >;
  readonly reviews: CarReviewsResponse;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

const STAR_LEVELS = [5, 4, 3, 2, 1] as const;

export function ReviewSheet({ car, reviews, open, onOpenChange }: ReviewSheetProps) {
  const fetcher = useFetcher<CarReviewsLoaderData>();
  const location = useLocation();
  const lastGoodRef = useRef(reviews);
  const displayed = fetcher.data?.reviews ?? lastGoodRef.current;
  const pageLoadFailed =
    fetcher.state === "idle" && fetcher.data !== undefined && fetcher.data.reviews == null;
  const isPaging = fetcher.state !== "idle";
  const ratings = displayed.ratings;
  const totalReviews = ratings?.totalReviews ?? (displayed.pagination.total || car.totalReviews);
  const averageRating = ratings?.averageRating ?? car.averageRating;
  const roundedRating = averageRating.toFixed(1);

  const closeReviews = () => {
    fetcher.reset();
    lastGoodRef.current = reviews;
    onOpenChange(false);
  };

  const loadPage = (page: number) => {
    lastGoodRef.current = displayed;
    const params = new URLSearchParams(location.search);
    params.set("reviewsPage", String(page));
    fetcher.load(`${location.pathname}?${params}`);
  };

  const ratingBreakdown = STAR_LEVELS.map((stars) => {
    const count = ratings?.ratingDistribution[stars] ?? 0;
    const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;

    return { stars, count, percentage };
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          onOpenChange(true);
          return;
        }

        closeReviews();
      }}
    >
      <DialogContent
        showCloseButton
        className="max-h-[calc(100dvh-2rem)] w-full max-w-[min(64rem,calc(100%-2rem))] overflow-y-auto overscroll-contain sm:max-w-[min(64rem,calc(100%-2rem))]"
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
            {pageLoadFailed ? (
              <p className="text-sm text-red-600" role="alert">
                Couldn't load more reviews. Showing the last page that loaded.
              </p>
            ) : null}
            <ReviewList reviews={displayed.reviews} />
            {displayed.pagination.totalPages > 1 ? (
              <div className="flex items-center justify-between gap-3">
                {displayed.pagination.hasPreviousPage ? (
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    disabled={isPaging}
                    onClick={() => loadPage(displayed.pagination.page - 1)}
                  >
                    Previous reviews
                  </Button>
                ) : (
                  <span />
                )}
                {displayed.pagination.hasNextPage ? (
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    disabled={isPaging}
                    onClick={() => loadPage(displayed.pagination.page + 1)}
                  >
                    Next reviews
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
