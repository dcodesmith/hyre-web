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

export function bookingPricingPreviewSearchParams(input: BookingPricingInput) {
  const body = toPricingPreviewBody(input);

  if (!body) {
    return null;
  }

  const params = new URLSearchParams({
    carId: body.carId,
    bookingType: body.bookingType,
    startDate: body.startDate,
    endDate: body.endDate,
    pickupTime: body.pickupTime,
    requiresFullTank: String(body.requiresFullTank),
    useCredits: String(body.useCredits),
  });

  for (const addonId of body.addonIds) {
    params.append("addonIds", addonId);
  }

  return params;
}

/** Synchronizes complete booking inputs with the API-owned pricing preview. */
export function useBookingPricingPreview(input: BookingPricingInput | null) {
  const fetcher = useFetcher<BookingPricingPreviewLoaderData>();
  const fetcherRef = useRef(fetcher);

  const params = input ? bookingPricingPreviewSearchParams(input) : null;
  const requestKey = params?.toString() ?? null;

  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

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
