import { useFetcher } from "@remix-run/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ReviewCard } from "./ReviewCard";
import { Skeleton } from "../ui/skeleton";
import { Card } from "../ui/card";
import { CarouselNavigation } from "../ui/carousel-navigation";
import { useCarouselScroll } from "~/hooks/useCarouselScroll";
import type { ReviewWithBookingLight } from "~/services/reviews.server";

interface ReviewCarouselProps {
  readonly endpoint: string;
  readonly initialReviews?: ReviewWithBookingLight[];
  readonly title?: string;
  readonly limit?: number;
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

export function ReviewCarousel({
  endpoint,
  initialReviews,
  title = "Reviews",
  limit = 10,
  className,
}: ReviewCarouselProps) {
  const fetcher = useFetcher<PaginatedReviewsResponse>();
  const [reviews, setReviews] = useState<ReviewWithBookingLight[]>(initialReviews ?? []);
  const isFirstRender = useRef(true);
  const { scrollContainerRef, canScrollLeft, canScrollRight, scroll, checkScroll } =
    useCarouselScroll({ dependencies: [reviews] });

  // Fetch reviews on mount if no initial reviews, or refresh when endpoint/limit change
  useEffect(() => {
    const params = new URLSearchParams();
    params.set("page", "1");
    params.set("limit", limit.toString());

    if (isFirstRender.current) {
      // First render: only fetch if no initial reviews provided
      if (!initialReviews || initialReviews.length === 0) {
        fetcher.load(`${endpoint}?${params.toString()}`);
      }
      isFirstRender.current = false;
    } else {
      // Subsequent runs: always refresh data when endpoint or limit changes
      fetcher.load(`${endpoint}?${params.toString()}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, limit]);

  // Update reviews when fetcher data changes
  useEffect(() => {
    if (fetcher.data?.success && fetcher.data.reviews) {
      setReviews(fetcher.data.reviews);
    }
  }, [fetcher.data]);

  const handleScrollLeft = useCallback(() => scroll("left"), [scroll]);
  const handleScrollRight = useCallback(() => scroll("right"), [scroll]);

  const isLoading = fetcher.state === "loading" && reviews.length === 0;

  if (isLoading) {
    return (
      <section className={`${className ?? ""} mb-8`}>
        <div className="mb-4">
          <h3 className="text-lg md:text-xl font-semibold">{title}</h3>
        </div>
        <div className="flex gap-x-4 md:gap-x-6 overflow-x-auto scrollbar-hide">
          {[1, 2, 3].map((i) => (
            <div key={i} className="min-w-[280px] md:min-w-[320px] flex-shrink-0">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-20 w-full" />
                <div className="flex items-center gap-2.5 pt-2">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (reviews.length === 0) {
    return (
      <section className={`${className ?? ""} mb-8`}>
        <div className="mb-4">
          <h3 className="text-lg md:text-xl font-semibold">{title}</h3>
        </div>
        <Card>
          <div className="p-6 text-center">
            <p className="text-gray-500">No reviews yet.</p>
          </div>
        </Card>
      </section>
    );
  }

  return (
    <section className={`${className ?? ""} mb-8`}>
      {/* Header */}
      <div className="mb-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg md:text-xl font-semibold">{title}</h3>

          {/* Navigation Arrows */}
          <CarouselNavigation
            onScrollLeft={handleScrollLeft}
            onScrollRight={handleScrollRight}
            canScrollLeft={canScrollLeft}
            canScrollRight={canScrollRight}
          />
        </div>
      </div>

      {/* Scrollable Content */}
      <div
        ref={scrollContainerRef}
        onScroll={checkScroll}
        aria-label={`${title} carousel`}
        aria-roledescription="Carousel"
        className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide scroll-smooth"
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {reviews.map((review, index) => (
          <div key={review.id} className="flex items-stretch">
            <div className="w-[280px] md:w-[320px] flex-shrink-0 snap-start">
              <ReviewCard review={review} variant="carousel" />
            </div>
            {index < reviews.length - 1 && (
              <div className="flex items-center px-3 md:px-4 flex-shrink-0">
                <div className="w-px h-full bg-gray-200" />
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
