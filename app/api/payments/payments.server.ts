import { env } from "cloudflare:workers";

import { createApiClient } from "../api.server";
import { bookingPaymentStatusSchema, extensionPaymentStatusSchema } from "./schema";

let apiClient: ReturnType<typeof createApiClient> | undefined;

function getApiClient() {
  apiClient ??= createApiClient({ apiOrigin: env.API_ORIGIN });
  return apiClient;
}

interface PaymentStatusAccess {
  readonly request: Request;
  readonly paymentStatusToken?: string;
}

function accessHeaders(token: string | undefined) {
  return token ? { "X-Payment-Status-Token": token } : undefined;
}

export function getBookingPaymentStatus({
  request,
  txRef,
  bookingId,
  paymentStatusToken,
}: PaymentStatusAccess & { readonly txRef: string; readonly bookingId: string }) {
  const query = new URLSearchParams({ txRef, bookingId });

  return getApiClient().request({
    path: `/api/bookings/payment-status?${query.toString()}`,
    request,
    forwardCookie: paymentStatusToken == null,
    headers: accessHeaders(paymentStatusToken),
    schema: bookingPaymentStatusSchema,
  });
}

export function confirmBookingPayment({
  request,
  txRef,
  bookingId,
  transactionId,
  paymentStatusToken,
}: PaymentStatusAccess & {
  readonly txRef: string;
  readonly bookingId: string;
  readonly transactionId: string;
}) {
  return getApiClient().request({
    path: "/api/payments/booking-confirmation",
    method: "POST",
    request,
    forwardCookie: paymentStatusToken == null,
    headers: accessHeaders(paymentStatusToken),
    json: { txRef, bookingId, transactionId },
    schema: bookingPaymentStatusSchema,
  });
}

export function reconcileBookingExpiration({
  request,
  txRef,
  bookingId,
  paymentStatusToken,
}: PaymentStatusAccess & { readonly txRef: string; readonly bookingId: string }) {
  return getApiClient().request({
    path: "/api/payments/booking-expiration",
    method: "POST",
    request,
    forwardCookie: paymentStatusToken == null,
    headers: accessHeaders(paymentStatusToken),
    json: { txRef, bookingId },
    schema: bookingPaymentStatusSchema,
  });
}

export function getExtensionPaymentStatus({
  request,
  txRef,
}: {
  readonly request: Request;
  readonly txRef: string;
}) {
  return getApiClient().request({
    path: `/api/payments/status/${encodeURIComponent(txRef)}`,
    request,
    forwardCookie: true,
    schema: extensionPaymentStatusSchema,
  });
}

export function confirmExtensionPayment({
  request,
  extensionId,
  txRef,
  transactionId,
}: {
  readonly request: Request;
  readonly extensionId: string;
  readonly txRef: string;
  readonly transactionId: string;
}) {
  return getApiClient().request({
    path: "/api/payments/extension-confirmation",
    method: "POST",
    request,
    forwardCookie: true,
    json: { extensionId, txRef, transactionId },
    schema: extensionPaymentStatusSchema,
  });
}
