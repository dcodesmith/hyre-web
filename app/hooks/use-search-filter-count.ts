import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";

import type { CarSearchResponse } from "~/api/cars/schema";
import { applySearchFiltersToParams, type SearchFilterValues } from "~/search/search-url";

interface CountLoaderData {
  readonly result: CarSearchResponse | null;
}

/**
 * Debounced live result count for the filter dialog.
 *
 * The timer and fetcher.load are external synchronization, so they live in
 * this hook instead of the filter panel.
 */
export function useSearchFilterCount({
  open,
  draft,
  searchParams,
  searchPath = "/search",
}: {
  readonly open: boolean;
  readonly draft: SearchFilterValues;
  readonly searchParams: URLSearchParams;
  readonly searchPath?: string;
}) {
  const fetcher = useFetcher<CountLoaderData>();
  const fetcherRef = useRef(fetcher);
  const [requestedDraftKey, setRequestedDraftKey] = useState<string | null>(null);
  const draftKey = JSON.stringify(draft);

  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const timeout = setTimeout(() => {
      const params = applySearchFiltersToParams(
        new URLSearchParams(searchParams),
        JSON.parse(draftKey) as SearchFilterValues,
      );
      params.set("countOnly", "1");
      setRequestedDraftKey(draftKey);
      fetcherRef.current.load(`${searchPath}?${params.toString()}`);
    }, 300);

    return () => clearTimeout(timeout);
  }, [draftKey, open, searchParams, searchPath]);

  const countIsCurrent = fetcher.state === "idle" && requestedDraftKey === draftKey;

  return {
    countIsCurrent,
    resultCount: countIsCurrent ? fetcher.data?.result?.pagination?.total : undefined,
  };
}
