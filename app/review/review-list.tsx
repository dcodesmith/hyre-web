import type { CarReview } from "~/api/reviews/schema";
import { CompactStarRating } from "~/car/compact-star-rating";

const reviewDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Africa/Lagos",
});

function getInitials(name: string | null) {
  if (!name) {
    return "U";
  }

  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.at(0)?.toUpperCase() ?? "";
  const last = parts.length > 1 ? (parts.at(-1)?.at(0)?.toUpperCase() ?? "") : "";

  return `${first}${last}` || "U";
}

function formatReviewDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return reviewDateFormatter.format(date);
}

interface ReviewListProps {
  readonly reviews: readonly CarReview[];
}

export function ReviewList({ reviews }: ReviewListProps) {
  if (reviews.length === 0) {
    return <p className="text-sm text-gray-600">No reviews to show on this page.</p>;
  }

  return (
    <ul className="space-y-4">
      {reviews.map((review) => {
        const userName = review.user.name ?? "Anonymous";
        const initials = getInitials(review.user.name);
        const reviewedOn = formatReviewDate(review.createdAt);

        return (
          <li key={review.id} className="border-b border-gray-100 pb-4 last:border-b-0">
            <div className="flex items-start gap-3">
              {review.user.image ? (
                <img
                  src={review.user.image}
                  alt=""
                  width={40}
                  height={40}
                  className="size-10 rounded-full object-cover"
                />
              ) : (
                <div
                  aria-hidden="true"
                  className="flex size-10 items-center justify-center rounded-full bg-neutral-100 text-xs font-medium text-neutral-700"
                >
                  {initials}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{userName}</p>
                    {reviewedOn ? <p className="text-xs text-gray-500">{reviewedOn}</p> : null}
                  </div>
                  <CompactStarRating
                    rating={review.overallRating}
                    ariaLabel={`${review.overallRating.toFixed(1)} out of 5 stars`}
                  />
                </div>
                {review.comment ? (
                  <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap text-gray-700">
                    {review.comment}
                  </p>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
