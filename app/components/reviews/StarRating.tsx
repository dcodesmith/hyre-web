import { Star } from "lucide-react";
import * as React from "react";
import { cn } from "~/lib/utils";

type RatingValue = 1 | 2 | 3 | 4 | 5;

interface StarRatingProps {
  /**
   * Current rating value (0-5, supports decimals like 4.6)
   */
  readonly rating: number;
  /**
   * Display mode:
   * - "default": 5 stars with partial fills (e.g., 4.6 = 4 full + 1 at 60%)
   * - "compact": Single star where fill % = rating/5 (e.g., 2.5 = 50% filled)
   */
  readonly mode?: "default" | "compact";
  /**
   * Color variant:
   * - "amber": Yellow/gold stars (default)
   * - "black": Black stars
   */
  readonly variant?: "amber" | "black";
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
  sm: "h-3 w-3",
  md: "h-4 w-4",
  lg: "h-5 w-5",
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
   * Color variant
   */
  readonly variant?: "amber" | "black";
  /**
   * Additional CSS classes
   */
  readonly className?: string;
}

/**
 * A single star that can be partially filled using CSS clip
 */
function PartialStar({
  fillPercentage,
  size,
  isHovered,
  variant = "amber",
  className,
}: PartialStarProps) {
  const starSize = sizeClasses[size];
  const clampedPercentage = Math.max(0, Math.min(100, fillPercentage));

  const emptyStarClass =
    variant === "black" ? "fill-neutral-300 text-neutral-300" : "fill-neutral-200 text-neutral-200";

  let filledStarClass: string;
  if (variant === "black") {
    filledStarClass = "fill-gray-900 text-gray-900";
  } else if (isHovered) {
    filledStarClass = "fill-amber-300 text-amber-300";
  } else {
    filledStarClass = "fill-amber-400 text-amber-400";
  }

  // If hovered, show full highlight
  if (isHovered && variant === "amber") {
    return (
      <div className={cn("relative inline-flex", className)}>
        <Star className={cn(starSize, "fill-amber-300 text-amber-300")} />
      </div>
    );
  }

  return (
    <div className={cn("relative inline-flex", className)}>
      {/* Empty star (background) */}
      <Star className={cn(starSize, emptyStarClass)} />
      {/* Filled star (foreground, clipped) */}
      {clampedPercentage > 0 && (
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ width: `${clampedPercentage}%` }}
        >
          <Star className={cn(starSize, filledStarClass)} />
        </div>
      )}
    </div>
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
  variant = "amber",
  interactive = false,
  onRatingChange,
  size = "md",
  className,
  ariaLabel,
}: StarRatingProps) {
  const [hoveredRating, setHoveredRating] = React.useState<number | null>(null);
  const [isKeyboardFocused, setIsKeyboardFocused] = React.useState(false);

  // Clamp rating to valid range (0-5)
  const clampedRating = Math.max(0, Math.min(5, rating));

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
    const filledStarClass =
      variant === "black" ? "fill-gray-900 text-gray-900" : "fill-amber-400 text-amber-400";

    return (
      <div
        className={cn("inline-flex items-center", className)}
        aria-label={ariaLabel ?? `${rating} out of 5 stars`}
      >
        <Star className={cn(starSize, filledStarClass)} />
      </div>
    );
  }

  // Default mode: 5 stars with partial fills
  const isInteractive = interactive && onRatingChange;
  const focusedStar = Math.max(1, Math.round(clampedRating) || 1) as RatingValue;

  return (
    <div
      className={cn("inline-flex items-center gap-0.5", className)}
      role={isInteractive ? "radiogroup" : undefined}
      aria-label={ariaLabel ?? `${rating} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((position) => {
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
            onClick={() => handleClick(position as RatingValue)}
            onMouseEnter={() => isInteractive && setHoveredRating(position)}
            onMouseLeave={() => isInteractive && setHoveredRating(null)}
            onFocus={() => isInteractive && setIsKeyboardFocused(true)}
            onBlur={() => setIsKeyboardFocused(false)}
            onKeyDown={(e) => handleKeyDown(e, position as RatingValue)}
            aria-label={`${position} star${position === 1 ? "" : "s"}`}
            aria-pressed={position <= Math.round(rating)}
            tabIndex={getTabIndex()}
            disabled={!isInteractive}
          >
            <PartialStar
              fillPercentage={fillPercentage}
              size={size}
              variant={variant}
              isHovered={isHovered}
            />
          </button>
        );
      })}
    </div>
  );
}
