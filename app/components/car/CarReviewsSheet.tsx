import {
  SparklesIcon,
  UserIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import { ReviewList } from "~/components/reviews/ReviewList";
import { Sheet, SheetContent } from "~/components/ui/sheet";
import type { AggregatedRatings } from "~/services/reviews.server";
import { formatRating } from "~/utils/review-formatting";

type SubRatings = {
  readonly car: number;
  readonly chauffeur: number | null;
  readonly service: number;
};

type CarReviewsSheetProps = {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly carId: string;
  readonly ratings: AggregatedRatings;
  readonly subRatings: SubRatings;
};

export function CarReviewsSheet({
  open,
  onOpenChange,
  carId,
  ratings,
  subRatings,
}: CarReviewsSheetProps) {
  const roundedRating = formatRating(ratings.averageRating);
  const ratingBreakdown = [5, 4, 3, 2, 1].map((stars) => {
    const count = ratings.ratingDistribution[stars as keyof typeof ratings.ratingDistribution] ?? 0;
    const percentage = ratings.totalReviews > 0 ? (count / ratings.totalReviews) * 100 : 0;
    return { stars, count, percentage };
  });

  const categoryRatings = [
    {
      label: "Vehicle quality",
      value: subRatings.car,
      Icon: WrenchScrewdriverIcon,
    },
    { label: "Driver quality", value: subRatings.chauffeur, Icon: UserIcon },
    { label: "Service quality", value: subRatings.service, Icon: SparklesIcon },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[92vh] max-h-[92vh] w-full overflow-y-auto rounded-t-3xl px-4 sm:px-6 lg:px-8"
      >
        <div className="mx-auto w-full max-w-5xl py-4 sm:py-6">
          <div className="lg:grid lg:grid-cols-[280px,1fr] lg:gap-12">
            <div className="mb-2 lg:mb-0">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xl">&#9733;</span>
                <span className="text-xl font-medium">{roundedRating}</span>
              </div>

              <div className="-mx-4 mb-2 px-4 overflow-x-auto lg:hidden bg-gray-50 border-b scrollbar-hide [scrollbar-width:none] [-ms-overflow-style:none]">
                <div className="inline-flex w-max items-stretch">
                  <div className="shrink-0 py-4 pr-4 border-r border-gray-200">
                    <p className="text-xs font-semibold text-gray-900 mb-3">Overall rating</p>
                    <div className="flex flex-col gap-1">
                      {ratingBreakdown.map(({ stars, percentage }) => (
                        <div key={stars} className="flex items-center gap-2">
                          <span className="w-3 text-xs leading-none text-gray-700">{stars}</span>
                          <div className="h-1 w-40 rounded-full bg-gray-200 overflow-hidden">
                            <div
                              className="h-full bg-gray-900 transition-all duration-300"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {categoryRatings.map(({ label, value, Icon }) => (
                    <div
                      key={label}
                      className="shrink-0 px-4 py-4 border-r border-gray-200 last:border-r-0 flex flex-col justify-between"
                    >
                      <div className="flex flex-col">
                        <p className="text-xs font-semibold text-gray-900 mb-2">{label}</p>
                        <p className="text-xs leading-none font-semibold text-gray-900 mb-3">
                          {value != null && value > 0 ? formatRating(value) : "—"}
                        </p>
                      </div>

                      <Icon className="h-8 w-8 text-gray-700" />
                    </div>
                  ))}
                </div>
              </div>

              <p className="hidden lg:block text-base font-semibold text-gray-900 mb-3">
                Overall rating
              </p>
              <div className="hidden lg:flex lg:flex-col lg:gap-2 lg:mb-6">
                {ratingBreakdown.map(({ stars, count, percentage }) => (
                  <div key={stars} className="flex items-center gap-3">
                    <span className="w-3 text-sm text-gray-700">{stars}</span>
                    <div className="h-1.5 flex-1 rounded-full bg-gray-200 overflow-hidden">
                      <div
                        className="h-full bg-gray-900 transition-all duration-300"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="w-6 text-right text-sm text-gray-600">{count}</span>
                  </div>
                ))}
              </div>

              <div className="hidden lg:block border-t border-gray-200">
                {categoryRatings.map(({ label, value, Icon }) => (
                  <div
                    key={label}
                    className="flex items-center justify-between border-b border-gray-200 py-4"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-5 w-5 text-gray-700" />
                      <span className="text-[15px] font-medium text-gray-900">{label}</span>
                    </div>
                    <span className="text-[15px] font-semibold text-gray-900">
                      {value != null && value > 0 ? formatRating(value) : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-medium">
                {ratings.totalReviews} {ratings.totalReviews === 1 ? "review" : "reviews"}
              </h3>
              <ReviewList endpoint={`/api/reviews/car/${carId}`} />
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
