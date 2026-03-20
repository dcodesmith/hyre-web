import { useFetcher } from "react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Skeleton } from "../ui/skeleton";
import { ReviewCard } from "./ReviewCard";
import type { ReviewWithBookingLight } from "~/services/reviews.server";

interface ReviewListProps {
  /**
   * API endpoint to fetch reviews from (e.g., "/api/reviews/car/carId" or "/api/reviews/chauffeur/chauffeurId")
   */
  readonly endpoint: string;
  /**
   * Initial reviews data (optional, for SSR)
   */
  readonly initialReviews?: ReviewWithBookingLight[];
  /**
   * Initial pagination data (optional, for SSR)
   */
  readonly initialPagination?: {
    readonly page: number;
    readonly limit: number;
    readonly total: number;
    readonly totalPages: number;
    readonly hasNextPage: boolean;
    readonly hasPreviousPage: boolean;
  };
  readonly showDetailedRatings?: boolean;
  readonly className?: string;
}

interface PaginatedReviewsResponse {
  readonly success: boolean;
  readonly reviews?: ReviewWithBookingLight[];
  readonly pagination?: {
    readonly page: number;
    readonly limit: number;
    readonly total: number;
    readonly totalPages: number;
    readonly hasNextPage: boolean;
    readonly hasPreviousPage: boolean;
  };
  readonly error?: string;
}

export function ReviewList({
  endpoint,
  initialReviews,
  initialPagination,
  showDetailedRatings = false,
  className,
}: ReviewListProps) {
  const fetcher = useFetcher<PaginatedReviewsResponse>();
  const [reviews, setReviews] = useState<ReviewWithBookingLight[]>(initialReviews ?? []);
  const [pagination, setPagination] = useState(initialPagination);
  const [currentPage, setCurrentPage] = useState(initialPagination?.page ?? 1);
  const loadRef = useRef(fetcher.load);

  useEffect(() => {
    loadRef.current = fetcher.load;
  }, [fetcher.load]);

  const isLoading = fetcher.state === "loading";
  const isSubmitting = fetcher.state === "submitting";

  const loadPage = useCallback(
    (page: number) => {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", (pagination?.limit ?? 10).toString());

      loadRef.current(`${endpoint}?${params.toString()}`);
      setCurrentPage(page);
    },
    [endpoint, pagination?.limit],
  );

  // Auto-load the first page on mount
  useEffect(() => {
    const initialPage = initialPagination?.page;
    const hasValidInitialPage =
      typeof initialPage === "number" &&
      Number.isFinite(initialPage) &&
      initialPage >= 1 &&
      (!initialPagination?.totalPages || initialPage <= initialPagination.totalPages);
    const hasValidCurrentPage =
      typeof currentPage === "number" &&
      Number.isFinite(currentPage) &&
      currentPage >= 1 &&
      (!pagination?.totalPages || currentPage <= pagination.totalPages);
    const hasSsrReviews = Array.isArray(initialReviews);
    const hasSsrData = hasSsrReviews || Boolean(initialPagination);
    const ssrPage = initialPagination?.page ?? 1;
    const hasMatchingSsrPage = hasSsrData && ssrPage === currentPage;

    if (hasMatchingSsrPage && hasValidInitialPage && hasValidCurrentPage) {
      return;
    }

    if (!hasSsrData || !hasValidInitialPage || !hasValidCurrentPage) {
      loadPage(1);
    }
  }, [currentPage, initialPagination, initialReviews, loadPage, pagination?.totalPages]);

  // Update reviews when fetcher data changes
  useEffect(() => {
    if (fetcher.data?.success && fetcher.data.reviews && fetcher.data.pagination) {
      setReviews(fetcher.data.reviews);
      setPagination(fetcher.data.pagination);
    }
  }, [fetcher.data]);

  const handleNextPage = () => {
    if (pagination?.hasNextPage) {
      loadPage(currentPage + 1);
    }
  };

  const handlePreviousPage = () => {
    if (pagination?.hasPreviousPage) {
      loadPage(currentPage - 1);
    }
  };

  if (!pagination && !isLoading && reviews.length === 0) {
    return (
      <div className={className}>
        <Card>
          <div className="p-6 text-center">
            <p className="text-gray-500">No reviews yet.</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="space-y-4">
        {/* Reviews */}
        {isLoading && reviews.length === 0 ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                  <Skeleton className="h-20 w-full" />
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <ReviewCard
                key={review.id}
                review={{
                  id: review.id,
                  overallRating: review.overallRating,
                  carRating: review.carRating,
                  chauffeurRating: review.chauffeurRating,
                  serviceRating: review.serviceRating,
                  comment: review.comment,
                  createdAt: review.createdAt,
                  user: review.user,
                }}
                showDetailedRatings={showDetailedRatings}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              Showing {reviews.length > 0 ? (currentPage - 1) * (pagination.limit ?? 10) + 1 : 0} to{" "}
              {Math.min(currentPage * (pagination.limit ?? 10), pagination.total)} of{" "}
              {pagination.total} reviews
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreviousPage}
                disabled={!pagination.hasPreviousPage || isSubmitting || isLoading}
              >
                Previous
              </Button>
              <div className="text-sm text-gray-600 px-2">
                Page {currentPage} of {pagination.totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={!pagination.hasNextPage || isSubmitting || isLoading}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
