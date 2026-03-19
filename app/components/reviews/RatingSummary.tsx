import type { AggregatedRatings } from "~/services/reviews.server";
import { Card, CardContent } from "../ui/card";
import { StarRating } from "./StarRating";

interface RatingSummaryProps {
  readonly ratings: AggregatedRatings;
  readonly showDistribution?: boolean;
  readonly className?: string;
}

export function RatingSummary({
  ratings,
  showDistribution = false,
  className,
}: RatingSummaryProps) {
  const { averageRating, totalReviews, ratingDistribution } = ratings;

  if (totalReviews === 0) {
    return (
      <Card className={className}>
        <CardContent className="space-y-6 pt-6">
          <div className="text-center py-6">
            <p className="text-gray-500 text-sm">No ratings yet</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const roundedAverage = averageRating.toFixed(1);

  return (
    <Card className={className}>
      <CardContent className="space-y-6 pt-6">
        {/* Average Rating */}
        <div className="flex items-center gap-4">
          <div className="text-4xl font-bold text-gray-900">{roundedAverage}</div>
          <div className="flex-1">
            <StarRating
              rating={averageRating}
              size="lg"
              ariaLabel={`Average rating: ${roundedAverage} out of 5 stars`}
            />
            <p className="text-sm text-gray-600 mt-1">
              Based on {totalReviews} {totalReviews === 1 ? "review" : "reviews"}
            </p>
          </div>
        </div>

        {/* Rating Distribution */}
        {showDistribution && (
          <div className="space-y-3 pt-4 border-t border-gray-100">
            <h4 className="text-sm font-medium text-gray-900">Rating Breakdown</h4>
            <div className="space-y-2">
              {[5, 4, 3, 2, 1].map((stars) => {
                const count = ratingDistribution[stars as keyof typeof ratingDistribution] ?? 0;
                const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;

                return (
                  <div key={stars} className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 min-w-[80px] shrink-0">
                      <span className="text-sm text-gray-600 w-4 text-right">{stars}</span>
                      <StarRating rating={stars} size="sm" ariaLabel={`${stars} stars`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-400 transition-all duration-300"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 min-w-[60px] text-right shrink-0">
                      {count} ({Math.round(percentage)}%)
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
