import { data } from "react-router";
import { z } from "zod";

import { ApiRequestError } from "~/api/api.server";
import { previewBookingPricing } from "~/api/bookings/bookings.server";
import { HTTP_STATUS } from "~/api/http-status";
import { BOOKING_TYPE_OPTIONS } from "~/booking/types";
import type { Route } from "./+types/api.booking-pricing-preview";

const NO_STORE = { "Cache-Control": "private, no-store" };
const PREVIEW_ERROR = "Unable to confirm the booking price. Please try again.";
const INTERNAL_SEARCH_PARAMS = ["_routes"] as const;

function pricingPreviewRequestKey(searchParams: URLSearchParams) {
  const params = new URLSearchParams(searchParams);

  for (const key of INTERNAL_SEARCH_PARAMS) {
    params.delete(key);
  }

  return params.toString();
}

const booleanParamSchema = z.enum(["true", "false"]).transform((value) => value === "true");
const pricingPreviewSearchSchema = z.object({
  carId: z.string().trim().min(1),
  bookingType: z.enum(BOOKING_TYPE_OPTIONS),
  startDate: z.iso.datetime({ offset: true }),
  endDate: z.iso.datetime({ offset: true }),
  pickupTime: z.string().trim().min(1),
  includeSecurityDetail: booleanParamSchema,
  requiresFullTank: booleanParamSchema,
  useCredits: z.coerce.number().min(0).max(99_999_999.99).multipleOf(0.01),
});

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const requestKey = pricingPreviewRequestKey(url.searchParams);
  const parsed = pricingPreviewSearchSchema.safeParse(Object.fromEntries(url.searchParams));

  if (!parsed.success) {
    return data(
      {
        requestKey,
        preview: null,
        error: "Select valid booking dates and a pickup time to confirm the price.",
      },
      { status: HTTP_STATUS.BAD_REQUEST, headers: NO_STORE },
    );
  }

  try {
    const response = await previewBookingPricing({ request, body: parsed.data });
    return data({ requestKey, preview: response.data, error: null }, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof ApiRequestError && error.kind === "aborted") {
      throw error;
    }

    const message =
      error instanceof ApiRequestError && error.status < HTTP_STATUS.INTERNAL_SERVER_ERROR
        ? error.problem.detail
        : PREVIEW_ERROR;

    return data(
      { requestKey, preview: null, error: message },
      {
        status: error instanceof ApiRequestError ? error.status : HTTP_STATUS.BAD_GATEWAY,
        headers: NO_STORE,
      },
    );
  }
}
