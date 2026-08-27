import { useEffect, useRef } from "react";
import { useFetcher } from "react-router";

import type { BookingPricingPreview } from "~/api/bookings/schema";
import {
  type BookingPricingInput,
  toPricingPreviewBody,
} from "~/booking/booking-create-form-schema";

interface BookingPricingPreviewLoaderData {
  readonly requestKey: string;
  readonly preview: BookingPricingPreview | null;
  readonly error: string | null;
}

function previewSearchParams(input: BookingPricingInput) {
  const body = toPricingPreviewBody(input);

  if (!body) {
    return null;
  }

  return new URLSearchParams({
    carId: body.carId,
    bookingType: body.bookingType,
    startDate: body.startDate,
    endDate: body.endDate,
    pickupTime: body.pickupTime,
    includeSecurityDetail: String(body.includeSecurityDetail),
    requiresFullTank: String(body.requiresFullTank),
    useCredits: String(body.useCredits),
  });
}

/** Synchronizes complete booking inputs with the API-owned pricing preview. */
export function useBookingPricingPreview(input: BookingPricingInput | null) {
  const fetcher = useFetcher<BookingPricingPreviewLoaderData>();
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const params = input ? previewSearchParams(input) : null;
  const requestKey = params?.toString() ?? null;

  useEffect(() => {
    if (!requestKey) {
      fetcherRef.current.reset();
      return;
    }

    void fetcherRef.current.load(`/api/booking-pricing-preview?${requestKey}`);
  }, [requestKey]);

  const resultIsCurrent = requestKey != null && fetcher.data?.requestKey === requestKey;
  const isLoading = requestKey != null && (fetcher.state !== "idle" || !resultIsCurrent);

  return {
    preview: resultIsCurrent ? (fetcher.data?.preview ?? null) : null,
    error: resultIsCurrent ? (fetcher.data?.error ?? null) : null,
    isLoading,
  };
}
