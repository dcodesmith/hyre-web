import { env } from "cloudflare:workers";

import { createApiClient } from "../api.server";
import {
  bookingDetailSchema,
  bookingPricingPreviewSchema,
  bookingsByStatusSchema,
  cancelBookingResponseSchema,
  createBookingResponseSchema,
} from "./schema";

const USER_CANCEL_REASON = "User requested cancellation";

let apiClient: ReturnType<typeof createApiClient> | undefined;

function getApiClient() {
  apiClient ??= createApiClient({ apiOrigin: env.API_ORIGIN });

  return apiClient;
}

export type GetBookingsByStatusOptions = {
  request: Request;
};

export function getBookingsByStatus(options: GetBookingsByStatusOptions) {
  return getApiClient().request({
    path: "/api/bookings",
    request: options.request,
    forwardCookie: true,
    schema: bookingsByStatusSchema,
  });
}

export type GetBookingByIdOptions = {
  request: Request;
  bookingId: string;
};

export function getBookingById(options: GetBookingByIdOptions) {
  return getApiClient().request({
    path: `/api/bookings/${encodeURIComponent(options.bookingId)}`,
    request: options.request,
    forwardCookie: true,
    schema: bookingDetailSchema,
  });
}

export type CancelBookingOptions = {
  request: Request;
  bookingId: string;
};

export function cancelBooking(options: CancelBookingOptions) {
  return getApiClient().request({
    path: `/api/bookings/${encodeURIComponent(options.bookingId)}/cancel`,
    method: "PATCH",
    request: options.request,
    forwardCookie: true,
    json: { reason: USER_CANCEL_REASON },
    schema: cancelBookingResponseSchema,
  });
}

export type PreviewBookingPricingOptions = {
  request: Request;
  body: unknown;
};

export function previewBookingPricing(options: PreviewBookingPricingOptions) {
  return getApiClient().request({
    path: "/api/bookings/pricing-preview",
    request: options.request,
    forwardCookie: true,
    json: options.body,
    schema: bookingPricingPreviewSchema,
  });
}

export type CreateBookingOptions = {
  request: Request;
  body: unknown;
  idempotencyKey: string;
};

export function createBooking(options: CreateBookingOptions) {
  return getApiClient().request({
    path: "/api/bookings",
    request: options.request,
    forwardCookie: true,
    headers: { "Idempotency-Key": options.idempotencyKey },
    json: options.body,
    schema: createBookingResponseSchema,
  });
}
