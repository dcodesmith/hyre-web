import { useEffect } from "react";
import { useNavigation, useSearchParams } from "react-router";

export function useSearchJourneyUrl(searchId: string | undefined) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigation = useNavigation();
  const currentSearchId = searchParams.get("searchId");
  const canSync = navigation.state === "idle";
  const pendingSearchId = navigation.location
    ? new URLSearchParams(navigation.location.search).get("searchId")
    : null;
  const canUseResult = canSync || pendingSearchId === searchId;

  useEffect(() => {
    if (!canSync || !searchId || currentSearchId === searchId) {
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
  }, [canSync, currentSearchId, searchId, setSearchParams]);

  if (!canUseResult || !searchId || currentSearchId === searchId) {
    return searchParams;
  }

  const effectiveSearchParams = new URLSearchParams(searchParams);
  effectiveSearchParams.set("searchId", searchId);
  return effectiveSearchParams;
}
