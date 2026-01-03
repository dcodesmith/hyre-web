import { formatDistanceToNow } from "date-fns";
import { Card, CardContent } from "../ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { StarRating } from "./StarRating";

interface ReviewCardProps {
  readonly review: {
    readonly id: string;
    readonly overallRating: number;
    readonly carRating: number;
    readonly chauffeurRating: number;
    readonly serviceRating: number;
    readonly comment: string | null;
    readonly createdAt: string | Date;
    readonly user: {
      readonly id: string;
      readonly name: string | null;
      readonly image: string | null;
    };
  };
  readonly showDetailedRatings?: boolean;
  readonly className?: string;
  readonly variant?: "default" | "nested";
}

function getInitials(name: string | null): string {
  if (!name) return "U";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0]?.at(0)?.toUpperCase() ?? "U";
  return `${parts[0]?.at(0)?.toUpperCase() ?? ""}${parts.at(-1)?.at(0)?.toUpperCase() ?? ""}`;
}

export function ReviewCard({
  review,
  showDetailedRatings = false,
  className,
  variant = "default",
}: ReviewCardProps) {
  const userName = review.user.name ?? "Anonymous";
  const userInitials = getInitials(review.user.name);
  const createdAt =
    typeof review.createdAt === "string" ? new Date(review.createdAt) : review.createdAt;
  const timeAgo = formatDistanceToNow(createdAt, { addSuffix: true });

  const content = (
    <div className="space-y-4">
      <div className="flex items-start gap-4">
        <Avatar className="h-10 w-10">
          <AvatarImage src={review.user.image ?? undefined} alt={userName} />
          <AvatarFallback className="bg-neutral-100 text-neutral-700">
            {userInitials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-medium text-gray-900">{userName}</p>
              <p className="text-sm text-gray-500">{timeAgo}</p>
            </div>
            <div className="flex-shrink-0">
              <StarRating
                rating={review.overallRating}
                size="sm"
                ariaLabel={`${review.overallRating} out of 5 stars`}
              />
            </div>
          </div>
        </div>
      </div>

      {showDetailedRatings && (
        <div className="grid grid-cols-3 gap-4 pt-2 border-t border-gray-100">
          <div className="space-y-1">
            <p className="text-xs text-gray-600">Car</p>
            <StarRating
              rating={review.carRating}
              size="sm"
              ariaLabel={`Car rating: ${review.carRating} stars`}
            />
          </div>
          <div className="space-y-1">
            <p className="text-xs text-gray-600">Chauffeur</p>
            <StarRating
              rating={review.chauffeurRating}
              size="sm"
              ariaLabel={`Chauffeur rating: ${review.chauffeurRating} stars`}
            />
          </div>
          <div className="space-y-1">
            <p className="text-xs text-gray-600">Service</p>
            <StarRating
              rating={review.serviceRating}
              size="sm"
              ariaLabel={`Service rating: ${review.serviceRating} stars`}
            />
          </div>
        </div>
      )}

      {review.comment && (
        <div className="pt-2">
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
            {review.comment}
          </p>
        </div>
      )}
    </div>
  );

  if (variant === "nested") {
    return <div className={className}>{content}</div>;
  }

  return (
    <Card className={className}>
      <CardContent className="p-6">{content}</CardContent>
    </Card>
  );
}
