import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";

import type { PlaceSuggestion } from "~/api/places/schema";

interface AutocompleteLoaderData {
  readonly suggestions: PlaceSuggestion[];
  readonly degraded: boolean;
  readonly error: string | null;
}

interface ResolveActionData {
  readonly placeId: string | null;
  readonly address: string | null;
  readonly error: string | null;
}

/**
 * Debounced same-origin places autocomplete + resolve.
 *
 * The timer and fetchers are external synchronization, so they live here
 * instead of in the address field.
 */
export function usePlaceAutocomplete({
  input,
  enabled,
  onResolved,
}: {
  readonly input: string;
  readonly enabled: boolean;
  readonly onResolved: (address: string) => void;
}) {
  const autocompleteFetcher = useFetcher<AutocompleteLoaderData>();
  const resolveFetcher = useFetcher<ResolveActionData>();
  const autocompleteFetcherRef = useRef(autocompleteFetcher);
  const onResolvedRef = useRef(onResolved);
  const sessionTokenRef = useRef<string | null>(null);
  const resolveFallbackRef = useRef("");
  const lastResolvedRef = useRef<string | null>(null);
  const [requestedInput, setRequestedInput] = useState<string | null>(null);

  autocompleteFetcherRef.current = autocompleteFetcher;
  onResolvedRef.current = onResolved;

  useEffect(() => {
    const trimmed = input.trim();

    if (!enabled || trimmed.length < 2) {
      return;
    }

    const timeout = setTimeout(() => {
      sessionTokenRef.current ??= crypto.randomUUID();
      const params = new URLSearchParams({
        input: trimmed,
        sessionToken: sessionTokenRef.current,
      });
      setRequestedInput(trimmed);
      autocompleteFetcherRef.current.load(`/api/places/autocomplete?${params}`);
    }, 250);

    return () => clearTimeout(timeout);
  }, [enabled, input]);

  useEffect(() => {
    if (resolveFetcher.state !== "idle" || resolveFetcher.data == null) {
      return;
    }

    const address = resolveFetcher.data.address ?? resolveFallbackRef.current;

    if (!address || address === lastResolvedRef.current) {
      return;
    }

    lastResolvedRef.current = address;
    onResolvedRef.current(address);
  }, [resolveFetcher.data, resolveFetcher.state]);

  const resolve = (placeId: string, fallbackAddress: string) => {
    lastResolvedRef.current = null;
    resolveFallbackRef.current = fallbackAddress;
    sessionTokenRef.current ??= crypto.randomUUID();
    resolveFetcher.submit(
      { placeId, sessionToken: sessionTokenRef.current },
      { method: "POST", action: "/api/places/resolve" },
    );
    sessionTokenRef.current = crypto.randomUUID();
  };

  const suggestionsAreCurrent =
    autocompleteFetcher.state === "idle" && requestedInput === input.trim();

  return {
    suggestions: suggestionsAreCurrent ? (autocompleteFetcher.data?.suggestions ?? []) : [],
    isLoadingSuggestions:
      autocompleteFetcher.state !== "idle" ||
      (requestedInput !== input.trim() && enabled && input.trim().length >= 2),
    isResolving: resolveFetcher.state !== "idle",
    resolve,
  };
}
