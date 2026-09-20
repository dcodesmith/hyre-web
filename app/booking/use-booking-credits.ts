import { useEffect, useEffectEvent, useState } from "react";
import { useFetcher } from "react-router";

export type ReferralCreditsData = {
  readonly availableCredits: number;
  readonly maxCreditsPerBooking: number;
  readonly error: string | null;
};

export function useBookingCredits(initialAppliedCredits: number, prefetch = false) {
  const fetcher = useFetcher<ReferralCreditsData>();
  const [enabled, setEnabled] = useState(initialAppliedCredits > 0);
  const error = enabled ? (fetcher.data?.error ?? null) : null;
  const data = fetcher.data?.error ? undefined : fetcher.data;
  const creditLimit = data ? Math.min(data.availableCredits, data.maxCreditsPerBooking) : 0;
  const hasUsableCredits = creditLimit > 0;
  const requestedCredits = enabled ? (data ? creditLimit : initialAppliedCredits) : 0;

  const prefetchBalance = useEffectEvent(() => {
    if (fetcher.state === "idle" && (!fetcher.data || fetcher.data.error)) {
      void fetcher.load("/api/referral-credits");
    }
  });

  useEffect(() => {
    if (prefetch) {
      prefetchBalance();
    }
  }, [prefetch]);

  function setCreditsEnabled(checked: boolean) {
    setEnabled(checked);
    if (checked && fetcher.state === "idle" && (!fetcher.data || fetcher.data.error)) {
      void fetcher.load("/api/referral-credits");
    }
  }

  return {
    availableCredits: data?.availableCredits ?? 0,
    creditLimit,
    enabled,
    error,
    hasUsableCredits,
    isLoading:
      enabled && !error && (fetcher.state !== "idle" || (!data && initialAppliedCredits <= 0)),
    requestedCredits,
    setCreditsEnabled,
  };
}
