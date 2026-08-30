import { env } from "cloudflare:workers";
import { data, redirect, type ShouldRevalidateFunctionArgs } from "react-router";
import { z } from "zod";

import { ApiRequestError } from "~/api/api.server";
import { hasSessionCookie } from "~/api/auth/cookie-relay.server";
import { createBookingExtension, getBookingById } from "~/api/bookings/bookings.server";
import { HTTP_STATUS } from "~/api/http-status";
import { AUTH_NO_STORE } from "~/auth/guest-only.server";
import { authPath } from "~/auth/referer";
import { BookingExtensionPage } from "~/booking/booking-extension";
import {
  type BookingExtensionActionData,
  bookingExtensionFormSchema,
} from "~/booking/booking-extension-form-schema";
import {
  createExtensionPaymentStatusSession,
  paymentStatusSetCookie,
  requirePaymentStatusCookieSecret,
} from "~/payment/payment-status-session.server";
import { buildPageMetadata } from "~/seo/metadata";
import type { Route } from "./+types/bookings.$bookingId.extend";

const EXTENSION_CREATE_ERROR = "Unable to reserve this extension. Please try again.";
const REVALIDATE_ERROR_CODES = new Set([
  "EXTENSION_IDEMPOTENCY_KEY_REUSED",
  "EXTENSION_PAYMENT_PENDING",
  "EXTENSION_PAYMENT_SESSION_EXPIRED",
  "EXTENSION_STATE_CHANGED",
]);

export function meta({ loaderData }: Route.MetaArgs) {
  return buildPageMetadata({
    title: loaderData
      ? `Extend booking ${loaderData.booking.bookingReference} | Tripdly`
      : "Extend booking | Tripdly",
    description: "Extend an eligible Tripdly booking day and continue to secure payment.",
    path: loaderData ? `/bookings/${loaderData.booking.id}/extend` : "/bookings",
    index: false,
  });
}

export function headers() {
  return AUTH_NO_STORE;
}

function loginRedirect(request: Request) {
  const url = new URL(request.url);
  return redirect(authPath("/auth", { redirectTo: `${url.pathname}${url.search}` }), {
    headers: AUTH_NO_STORE,
  });
}

export async function loader({ request, params }: Route.LoaderArgs) {
  if (!params.bookingId) {
    throw data(null, { status: HTTP_STATUS.NOT_FOUND });
  }

  if (!hasSessionCookie(request.headers.get("Cookie"))) {
    throw loginRedirect(request);
  }

  try {
    const booking = await getBookingById({ request, bookingId: params.bookingId });
    return { booking: booking.data, idempotencyKey: crypto.randomUUID() };
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === HTTP_STATUS.UNAUTHORIZED) {
      throw loginRedirect(request);
    }

    if (error instanceof ApiRequestError && error.status === HTTP_STATUS.NOT_FOUND) {
      throw data(null, { status: HTTP_STATUS.NOT_FOUND });
    }

    throw error;
  }
}

export async function action({ request, params }: Route.ActionArgs) {
  if (!params.bookingId) {
    throw data(null, { status: HTTP_STATUS.NOT_FOUND });
  }

  if (!hasSessionCookie(request.headers.get("Cookie"))) {
    throw loginRedirect(request);
  }

  const parsed = bookingExtensionFormSchema.safeParse(Object.fromEntries(await request.formData()));

  if (!parsed.success) {
    return data<BookingExtensionActionData>(
      {
        fieldErrors: z.flattenError(parsed.error).fieldErrors,
        revalidate: false,
      },
      { status: HTTP_STATUS.BAD_REQUEST, headers: AUTH_NO_STORE },
    );
  }

  requirePaymentStatusCookieSecret();

  try {
    const created = await createBookingExtension({
      request,
      bookingId: params.bookingId,
      body: {
        bookingLegId: parsed.data.bookingLegId,
        hours: parsed.data.hours,
        callbackUrl: new URL("/bookings/payment-status", env.APP_ORIGIN).toString(),
      },
      idempotencyKey: parsed.data.idempotencyKey,
    });
    const paymentSession = createExtensionPaymentStatusSession({
      bookingId: params.bookingId,
      extensionId: created.data.extensionId,
      txRef: created.data.paymentIntentId,
    });

    throw redirect(created.data.checkoutUrl, {
      headers: { "Set-Cookie": await paymentStatusSetCookie(paymentSession) },
    });
  } catch (error) {
    return extensionActionFailure(error, request, params.bookingId);
  }
}

function extensionActionFailure(error: unknown, request: Request, bookingId: string) {
  if (error instanceof Response) {
    throw error;
  }

  if (error instanceof ApiRequestError && error.status === HTTP_STATUS.UNAUTHORIZED) {
    throw loginRedirect(request);
  }

  if (
    error instanceof ApiRequestError &&
    error.problem.errorCode === "EXTENSION_ALREADY_CONFIRMED"
  ) {
    throw redirect(`/bookings/${encodeURIComponent(bookingId)}`, {
      headers: AUTH_NO_STORE,
    });
  }

  if (error instanceof ApiRequestError && error.kind === "aborted") {
    throw error;
  }

  const isApiError = error instanceof ApiRequestError;
  const errorCode = isApiError ? error.problem.errorCode : undefined;
  const headers = new Headers(AUTH_NO_STORE);
  const retryAfter = isApiError ? error.headers.get("Retry-After") : null;
  if (retryAfter) {
    headers.set("Retry-After", retryAfter);
  }

  return data<BookingExtensionActionData>(
    {
      error:
        isApiError && error.status < HTTP_STATUS.INTERNAL_SERVER_ERROR
          ? error.problem.detail
          : EXTENSION_CREATE_ERROR,
      ...(errorCode && REVALIDATE_ERROR_CODES.has(errorCode) ? {} : { revalidate: false as const }),
    },
    {
      status: isApiError ? error.status : HTTP_STATUS.BAD_GATEWAY,
      headers,
    },
  );
}

export function shouldRevalidate({
  actionResult,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if ((actionResult as BookingExtensionActionData | undefined)?.revalidate === false) {
    return false;
  }

  return defaultShouldRevalidate;
}

export default function BookingExtensionRoute({ actionData, loaderData }: Route.ComponentProps) {
  return (
    <BookingExtensionPage
      actionData={actionData}
      booking={loaderData.booking}
      idempotencyKey={loaderData.idempotencyKey}
    />
  );
}
