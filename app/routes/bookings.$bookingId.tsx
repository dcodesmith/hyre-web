import { data, redirect } from "react-router";

import { ApiRequestError } from "~/api/api.server";
import { hasSessionCookie } from "~/api/auth/cookie-relay.server";
import { getBookingById } from "~/api/bookings/bookings.server";
import { AUTH_NO_STORE } from "~/auth/guest-only.server";
import { authPath } from "~/auth/referer";
import { BookingDetailPage } from "~/booking/booking-detail";
import { buildPageMetadata } from "~/seo/metadata";
import type { Route } from "./+types/bookings.$bookingId";

export function meta({ loaderData }: Route.MetaArgs) {
  const { booking } = loaderData;
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
    throw data(null, { status: 404 });
  }

  if (!hasSessionCookie(request.headers.get("Cookie"))) {
    throw loginRedirect(request);
  }

  try {
    const booking = await getBookingById({ request, bookingId: params.bookingId });

    return { booking: booking.data };
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 401) {
      throw loginRedirect(request);
    }

    if (error instanceof ApiRequestError && error.status === 404) {
      throw data(null, { status: 404 });
    }

    throw error;
  }
}

export default function BookingDetailRoute({ loaderData }: Route.ComponentProps) {
  return <BookingDetailPage booking={loaderData.booking} />;
}
