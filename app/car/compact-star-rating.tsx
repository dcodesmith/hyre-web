import { cn } from "~/lib/utils";

interface CompactStarRatingProps {
  readonly rating: number;
  readonly className?: string;
  readonly ariaLabel?: string;
}

const STAR_POSITIONS = [1, 2, 3, 4, 5] as const;

function starFillPercent(position: number, rating: number) {
  if (rating >= position) {
    return 100;
  }

  if (rating > position - 1) {
    return (rating - (position - 1)) * 100;
  }

  return 0;
}

export function DetailStarRating({
  rating,
  ariaLabel,
}: {
  readonly rating: number;
  readonly ariaLabel?: string;
}) {
  const clampedRating = Math.max(0, Math.min(5, rating));
  const formattedRating = clampedRating.toFixed(1);

  return (
    <div
      role="img"
      className="inline-flex items-center gap-0.5 leading-none"
      aria-label={ariaLabel ?? `${formattedRating} out of 5 stars`}
    >
      {STAR_POSITIONS.map((position) => {
        const fillPercent = starFillPercent(position, clampedRating);

        return (
          <span
            key={position}
            aria-hidden="true"
            className="relative inline-block align-middle text-xs leading-none"
          >
            <span className="select-none text-neutral-300">&#9733;</span>
            {fillPercent > 0 ? (
              <span
                className="absolute top-0 left-0 overflow-hidden whitespace-nowrap"
                style={{ width: `${fillPercent}%` }}
              >
                <span className="select-none text-gray-900">&#9733;</span>
              </span>
            ) : null}
          </span>
        );
      })}
    </div>
  );
}

export function CompactStarRating({ rating, className, ariaLabel }: CompactStarRatingProps) {
  const clampedRating = Math.max(0, Math.min(5, rating));
  const fillPercent = (clampedRating / 5) * 100;
  const formattedRating = clampedRating.toFixed(1);

  return (
    <div
      role="img"
      className={cn("inline-flex items-center", className)}
      aria-label={ariaLabel ?? `${formattedRating} out of 5 stars`}
    >
      <span aria-hidden="true" className="relative inline-block align-middle text-xs leading-none">
        <span className="select-none text-neutral-300">&#9733;</span>
        {fillPercent > 0 ? (
          <span
            className="absolute top-0 left-0 overflow-hidden whitespace-nowrap"
            style={{ width: `${fillPercent}%` }}
          >
            <span className="select-none text-gray-900">&#9733;</span>
          </span>
        ) : null}
      </span>
    </div>
  );
}
