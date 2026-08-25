import { data, redirect } from "react-router";

import { ApiRequestError } from "~/api/api.server";
import { hasSessionCookie } from "~/api/auth/cookie-relay.server";
import { cancelBooking, getBookingById } from "~/api/bookings/bookings.server";
import { HTTP_STATUS } from "~/api/http-status";
import { AUTH_NO_STORE } from "~/auth/guest-only.server";
import { authPath } from "~/auth/referer";
import type { BookingCancelActionData } from "~/booking/booking-cancel";
import { cancelBookingFormSchema } from "~/booking/booking-cancel-form-schema";
import { BookingDetailPage } from "~/booking/booking-detail";
import { buildPageMetadata } from "~/seo/metadata";
import type { Route } from "./+types/bookings.$bookingId";

export function meta({ loaderData }: Route.MetaArgs) {
  const booking = loaderData?.booking;

  if (!booking) {
    return buildPageMetadata({
      title: "Booking | Tripdly",
      description: "View your Tripdly chauffeur booking.",
      path: "/bookings",
      index: false,
    });
  }

  const carName = `${booking.car.make} ${booking.car.model} ${booking.car.year}`;

  return buildPageMetadata({
    title: `Booking ${booking.bookingReference} - ${carName} | Tripdly`,
    description: `View booking details for ${carName}. Booking reference: ${booking.bookingReference}. Status: ${booking.status}.`,
    path: `/bookings/${booking.id}`,
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

    return { booking: booking.data, now: new Date().toISOString() };
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

  const parsed = cancelBookingFormSchema.safeParse(Object.fromEntries(await request.formData()));

  if (!parsed.success) {
    return data<BookingCancelActionData>(
      { error: "This booking cannot be cancelled." },
      { status: HTTP_STATUS.BAD_REQUEST, headers: AUTH_NO_STORE },
    );
  }

  try {
    await cancelBooking({ request, bookingId: params.bookingId });
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === HTTP_STATUS.UNAUTHORIZED) {
      throw loginRedirect(request);
    }

    if (error instanceof ApiRequestError && error.kind === "aborted") {
      throw error;
    }

    const message =
      error instanceof ApiRequestError && error.status < HTTP_STATUS.INTERNAL_SERVER_ERROR
        ? error.problem.detail
        : "Failed to cancel booking. Please try again.";

    return data<BookingCancelActionData>(
      { error: message },
      {
        status: error instanceof ApiRequestError ? error.status : HTTP_STATUS.BAD_GATEWAY,
        headers: AUTH_NO_STORE,
      },
    );
  }

  return data<BookingCancelActionData>({ ok: true }, { headers: AUTH_NO_STORE });
}

export default function BookingDetailRoute({ loaderData }: Route.ComponentProps) {
  return <BookingDetailPage booking={loaderData.booking} now={loaderData.now} />;
}
