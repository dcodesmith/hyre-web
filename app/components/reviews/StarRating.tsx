import * as React from "react";
import { cn } from "~/lib/utils";

const ratingValues = [1, 2, 3, 4, 5] as const;
type RatingValue = (typeof ratingValues)[number]; // 1 | 2 | 3 | 4 | 5

interface StarRatingProps {
  /**
   * Current rating value (0-5, supports decimals like 4.6)
   */
  readonly rating: number | null;
  /**
   * Display mode:
   * - "default": 5 stars with partial fills (e.g., 4.6 = 4 full + 1 at 60%)
   * - "compact": Single star where fill % = rating/5 (e.g., 2.5 = 50% filled)
   */
  readonly mode?: "default" | "compact";
  /**
   * Whether the rating is interactive (can be changed). Only works in default mode.
   */
  readonly interactive?: boolean;
  /**
   * Callback when rating changes (only used when interactive)
   */
  readonly onRatingChange?: (rating: RatingValue) => void;
  readonly size?: "sm" | "md" | "lg";
  readonly className?: string;
  readonly ariaLabel?: string;
}

const sizeClasses = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
};

interface PartialStarProps {
  /**
   * Fill percentage (0-100)
   */
  readonly fillPercentage: number;
  /**
   * Size of the star
   */
  readonly size: "sm" | "md" | "lg";
  /**
   * Whether this star is being hovered (shows full highlight)
   */
  readonly isHovered?: boolean;
  /**
   * Additional CSS classes
   */
  readonly className?: string;
}

/**
 * A single star that can be partially filled using CSS clip
 */
function PartialStar({ fillPercentage, size, isHovered, className }: PartialStarProps) {
  const starSize = sizeClasses[size];
  const clampedPercentage = Math.max(0, Math.min(100, fillPercentage));

  const emptyStarClass = "text-neutral-300";
  const filledStarClass = isHovered ? "text-gray-700" : "text-gray-900";

  // If hovered, show full highlight
  if (isHovered) {
    return (
      <span className={cn("relative inline-block leading-none align-middle", starSize, className)}>
        <span className="select-none text-gray-700">&#9733;</span>
      </span>
    );
  }

  return (
    <span className={cn("relative inline-block leading-none align-middle", starSize, className)}>
      {/* Empty star (background) */}
      <span className={cn("select-none", emptyStarClass)}>&#9733;</span>
      {/* Filled star (foreground, clipped) */}
      {clampedPercentage > 0 && (
        <span
          className="absolute left-0 top-0 overflow-hidden whitespace-nowrap"
          style={{ width: `${clampedPercentage}%` }}
        >
          <span className={cn("select-none", filledStarClass)}>&#9733;</span>
        </span>
      )}
    </span>
  );
}

/**
 * Calculates the fill percentage for a star at a given position
 * @param position - Star position (1-5)
 * @param rating - Current rating (0-5, can be decimal)
 * @returns Fill percentage (0-100)
 */
function getStarFillPercentage(position: number, rating: number): number {
  if (rating >= position) {
    return 100; // Fully filled
  }
  if (rating > position - 1) {
    // Partially filled: e.g., rating 4.6 at position 5 = 60%
    return (rating - (position - 1)) * 100;
  }
  return 0; // Empty
}

export function StarRating({
  rating,
  mode = "default",
  interactive = false,
  onRatingChange,
  size = "md",
  className,
  ariaLabel,
}: StarRatingProps) {
  const [hoveredRating, setHoveredRating] = React.useState<number | null>(null);
  const [isKeyboardFocused, setIsKeyboardFocused] = React.useState(false);

  const normalizedRating = typeof rating === "number" ? rating : 0;
  // Clamp rating to valid range (0-5)
  const clampedRating = Math.max(0, Math.min(5, normalizedRating));
  const formattedRating = clampedRating.toFixed(1);

  const handleClick = (value: RatingValue) => {
    if (interactive && onRatingChange) {
      onRatingChange(value);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent, value: RatingValue) => {
    if (!interactive) return;

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onRatingChange?.(value);
    } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault();
      const nextValue = Math.min(5, value + 1) as RatingValue;
      onRatingChange?.(nextValue);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault();
      const prevValue = Math.max(1, value - 1) as RatingValue;
      onRatingChange?.(prevValue);
    }
  };

  // Compact mode: Single filled star
  if (mode === "compact") {
    const starSize = sizeClasses[size];
    const fillPercent = Math.max(0, Math.min(100, (clampedRating / 5) * 100));
    const filledStarClass = "text-gray-900";
    const emptyStarClass = "text-neutral-300";

    return (
      <div
        className={cn("inline-flex items-center", className)}
        aria-label={ariaLabel ?? `${formattedRating} out of 5 stars`}
      >
        <span
          aria-hidden
          className={cn("relative inline-block leading-none align-middle", starSize)}
        >
          <span className={cn("select-none", emptyStarClass)}>&#9733;</span>
          {fillPercent > 0 && (
            <span
              className="absolute left-0 top-0 overflow-hidden whitespace-nowrap"
              style={{ width: `${fillPercent}%` }}
            >
              <span className={cn("select-none", filledStarClass)}>&#9733;</span>
            </span>
          )}
        </span>
      </div>
    );
  }

  // Default mode: 5 stars with partial fills
  const isInteractive = interactive && onRatingChange;
  const focusedStar = Math.max(1, Math.round(clampedRating) || 1) as RatingValue;

  return (
    <div
      className={cn("inline-flex items-center leading-none gap-0.5", className)}
      role={isInteractive ? "radiogroup" : undefined}
      aria-label={ariaLabel ?? `${formattedRating} out of 5 stars`}
    >
      {ratingValues.map((position) => {
        // For interactive mode with hover, show full stars up to hover position
        const isHovered = isInteractive && hoveredRating !== null && position <= hoveredRating;

        // Calculate fill percentage based on actual rating (when not hovering)
        const fillPercentage =
          hoveredRating === null ? getStarFillPercentage(position, clampedRating) : 0; // When hovering, PartialStar handles full highlight via isHovered

        const getTabIndex = (): number => {
          if (!isInteractive) return -1;
          return position === focusedStar ? 0 : -1;
        };

        return (
          <button
            key={position}
            type="button"
            className={cn(
              "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2 rounded-sm",
              isInteractive
                ? "cursor-pointer hover:scale-110 transition-transform"
                : "cursor-default",
              isKeyboardFocused &&
                position === focusedStar &&
                "ring-2 ring-neutral-950 ring-offset-2",
            )}
            onClick={() => handleClick(position)}
            onMouseEnter={() => isInteractive && setHoveredRating(position)}
            onMouseLeave={() => isInteractive && setHoveredRating(null)}
            onFocus={() => isInteractive && setIsKeyboardFocused(true)}
            onBlur={() => setIsKeyboardFocused(false)}
            onKeyDown={(e) => handleKeyDown(e, position)}
            aria-label={`${position} out of 5 stars`}
            aria-pressed={position <= Math.round(clampedRating)}
            tabIndex={getTabIndex()}
            disabled={!isInteractive}
          >
            <span aria-hidden="true">
              <PartialStar fillPercentage={fillPercentage} size={size} isHovered={isHovered} />
            </span>
          </button>
        );
      })}
    </div>
  );
}
