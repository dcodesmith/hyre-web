import { useState } from "react";
import { useFetcher } from "react-router";

export type ReferralCreditsData = {
  readonly availableCredits: number;
  readonly maxCreditsPerBooking: number;
  readonly error: string | null;
};

export function useBookingCredits(initialAppliedCredits: number) {
  const fetcher = useFetcher<ReferralCreditsData>();
  const [enabled, setEnabled] = useState(initialAppliedCredits > 0);
  const error = enabled ? (fetcher.data?.error ?? null) : null;
  const data = fetcher.data?.error ? undefined : fetcher.data;
  const requestedCredits = enabled
    ? data
      ? Math.min(data.availableCredits ?? 0, data.maxCreditsPerBooking ?? 0)
      : initialAppliedCredits
    : 0;

  function setCreditsEnabled(checked: boolean) {
    setEnabled(checked);
    if (checked && fetcher.state === "idle" && (!fetcher.data || fetcher.data.error)) {
      void fetcher.load("/api/referral-credits");
    }
  }

  return {
    data: fetcher.data,
    enabled,
    error,
    isLoading:
      enabled && !error && (fetcher.state !== "idle" || (!data && initialAppliedCredits <= 0)),
    requestedCredits,
    setCreditsEnabled,
  };
}
