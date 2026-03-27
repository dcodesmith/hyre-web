import { useCallback, useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";

interface PaginationData {
  readonly page: number;
  readonly limit: number;
  readonly total: number;
  readonly totalPages: number;
  readonly hasNextPage: boolean;
  readonly hasPreviousPage: boolean;
}

interface UseInfiniteScrollOptions<TItem, TRatings> {
  readonly initialItems: TItem[];
  readonly initialRatings: TRatings;
  readonly initialPagination: PaginationData | undefined;
  readonly searchParams: URLSearchParams;
  readonly searchPath?: string;
}

interface UseInfiniteScrollReturn<TItem, TRatings> {
  readonly allItems: TItem[];
  readonly allRatings: TRatings;
  readonly hasMore: boolean;
  readonly fetchError: string | null;
  readonly isLoading: boolean;
  readonly sentinelRef: React.RefObject<HTMLDivElement>;
  readonly initialItemsCount: number;
  readonly retry: () => void;
}

/**
 * Custom hook for infinite scroll functionality
 * Handles pagination, Intersection Observer, and data accumulation
 */
export function useInfiniteScroll<
  TItem extends { id: string },
  TRatings extends Record<string, unknown>,
>({
  initialItems,
  initialRatings,
  initialPagination,
  searchParams,
  searchPath = "/search",
}: UseInfiniteScrollOptions<TItem, TRatings>): UseInfiniteScrollReturn<TItem, TRatings> {
  const fetcher = useFetcher<{
    cars?: TItem[];
    ratings?: TRatings;
    pagination?: PaginationData;
  }>();
  const [allItems, setAllItems] = useState<TItem[]>(initialItems);
  const [allRatings, setAllRatings] = useState<TRatings>(initialRatings);
  const [currentPage, setCurrentPage] = useState(initialPagination?.page ?? 1);
  const [hasMore, setHasMore] = useState(initialPagination?.hasNextPage ?? false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const isFetchingRef = useRef(false);
  const initialItemsCount = initialItems.length;

  // Reset state when search filters change (initialItems from loader changes)
  // This is needed because useState only uses initial value on mount
  useEffect(() => {
    setAllItems(initialItems);
    setAllRatings(initialRatings);
    setCurrentPage(initialPagination?.page ?? 1);
    setHasMore(initialPagination?.hasNextPage ?? false);
    setFetchError(null);
    isFetchingRef.current = false;
  }, [initialItems, initialRatings, initialPagination]);

  useEffect(() => {
    const data = fetcher.data;
    const newCars = data?.cars;
    const newRatings = data?.ratings;

    if (newCars && data.pagination) {
      setAllItems((prev) => [...prev, ...newCars]);
      setAllRatings((prev) => ({ ...prev, ...newRatings }));
      setCurrentPage(data.pagination.page);
      setHasMore(data.pagination.hasNextPage);
      setFetchError(null);
    } else if (data && !newCars && data.pagination?.hasNextPage !== false) {
      setFetchError("Failed to load more vehicles. Please try again.");
    }
  }, [fetcher.data]);

  // Reset fetching flag when fetch completes
  useEffect(() => {
    if (fetcher.state === "idle") {
      isFetchingRef.current = false;
    }
  }, [fetcher.state]);

  // Intersection Observer to detect when user reaches sentinel
  useEffect(() => {
    if (!hasMore || fetcher.state === "loading" || isFetchingRef.current) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !isFetchingRef.current) {
          isFetchingRef.current = true;
          const nextPage = currentPage + 1;
          const params = new URLSearchParams(searchParams);
          params.set("page", nextPage.toString());
          fetcher.load(`${searchPath}?${params.toString()}`);
        }
      },
      { rootMargin: "300px" },
    );

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [hasMore, currentPage, searchParams, fetcher.state, fetcher, searchPath]);

  // Retry function
  const retry = useCallback(() => {
    setFetchError(null);
    isFetchingRef.current = true;
    const nextPage = currentPage + 1;
    const params = new URLSearchParams(searchParams);
    params.set("page", nextPage.toString());
    fetcher.load(`${searchPath}?${params.toString()}`);
  }, [currentPage, searchParams, fetcher, searchPath]);

  return {
    allItems,
    allRatings,
    hasMore,
    fetchError,
    isLoading: fetcher.state === "loading",
    sentinelRef,
    initialItemsCount,
    retry,
  };
}
