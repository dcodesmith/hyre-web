import { useEffect } from "react";
import { useNavigation, useSearchParams } from "react-router";
import { parseSearchId } from "~/search/search-url";

export function useSearchJourneyUrl(searchId: string | undefined) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigation = useNavigation();
  const currentSearchId = searchParams.get("searchId");
  const validCurrentSearchId = parseSearchId(currentSearchId);
  const canSync = navigation.state === "idle";
  const pendingSearchId = navigation.location
    ? new URLSearchParams(navigation.location.search).get("searchId")
    : null;
  const canUseResult = canSync || pendingSearchId === searchId;

  useEffect(() => {
    if (!canSync || !searchId || validCurrentSearchId) {
      return;
    }

    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set("searchId", searchId);
        return next;
      },
      { replace: true, preventScrollReset: true },
    );
  }, [canSync, searchId, setSearchParams, validCurrentSearchId]);

  if (!canUseResult || !searchId || validCurrentSearchId) {
    return searchParams;
  }

  const effectiveSearchParams = new URLSearchParams(searchParams);
  effectiveSearchParams.set("searchId", searchId);
  return effectiveSearchParams;
}
