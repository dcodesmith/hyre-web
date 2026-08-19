import { useCallback, useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";

interface PaginationData {
  readonly page: number;
  readonly hasNextPage: boolean;
}

interface InfiniteScrollLoaderData<TItem> {
  readonly result?: {
    readonly cars?: TItem[];
    readonly pagination?: PaginationData;
  };
}

interface UseInfiniteScrollOptions<TItem> {
  readonly initialItems: TItem[];
  readonly initialPagination: PaginationData | undefined;
  readonly searchParams: URLSearchParams;
  readonly searchPath?: string;
}

/**
 * Accumulates paginated search results as the sentinel enters the viewport.
 *
 * IntersectionObserver and fetcher completion are external systems, so the
 * observers live here rather than in the search page.
 */
export function useInfiniteScroll<TItem extends { id: string }>({
  initialItems,
  initialPagination,
  searchParams,
  searchPath = "/search",
}: UseInfiniteScrollOptions<TItem>) {
  const fetcher = useFetcher<InfiniteScrollLoaderData<TItem>>();
  const [allItems, setAllItems] = useState(initialItems);
  const [currentPage, setCurrentPage] = useState(initialPagination?.page ?? 1);
  const [hasMore, setHasMore] = useState(initialPagination?.hasNextPage ?? false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const isFetchingRef = useRef(false);
  const seenPageRef = useRef<number | null>(null);

  const loadPage = useCallback(
    (page: number) => {
      const params = new URLSearchParams(searchParams);
      params.set("page", String(page));
      params.delete("countOnly");
      isFetchingRef.current = true;
      void fetcher.load(`${searchPath}?${params.toString()}`);
    },
    [fetcher, searchParams, searchPath],
  );

  useEffect(() => {
    const data = fetcher.data?.result;
    const nextPage = data?.pagination?.page;

    if (!data || nextPage == null || seenPageRef.current === nextPage) {
      return;
    }

    seenPageRef.current = nextPage;

    const cars = data.cars;
    const pagination = data.pagination;

    if (cars && pagination) {
      setAllItems((current) => {
        const existingIds = new Set(current.map((item) => item.id));
        return [...current, ...cars.filter((car) => !existingIds.has(car.id))];
      });
      setCurrentPage(pagination.page);
      setHasMore(pagination.hasNextPage);
      setFetchError(null);
      return;
    }

    if (pagination?.hasNextPage !== false) {
      setFetchError("Failed to load more vehicles. Please try again.");
    }
  }, [fetcher.data]);

  useEffect(() => {
    if (fetcher.state === "idle") {
      isFetchingRef.current = false;
    }
  }, [fetcher.state]);

  useEffect(() => {
    if (!hasMore || fetcher.state === "loading" || isFetchingRef.current) {
      return;
    }

    const node = sentinelRef.current;

    if (!node) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !isFetchingRef.current) {
          loadPage(currentPage + 1);
        }
      },
      { rootMargin: "300px" },
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [currentPage, fetcher.state, hasMore, loadPage]);

  const retry = useCallback(() => {
    setFetchError(null);
    loadPage(currentPage + 1);
  }, [currentPage, loadPage]);

  return {
    allItems,
    hasMore,
    fetchError,
    isLoading: fetcher.state === "loading",
    sentinelRef,
    initialItemsCount: initialItems.length,
    retry,
  };
}
