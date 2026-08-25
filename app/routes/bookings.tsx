import { redirect } from "react-router";

import { ApiRequestError } from "~/api/api.server";
import { hasSessionCookie } from "~/api/auth/cookie-relay.server";
import { getBookingsByStatus } from "~/api/bookings/bookings.server";
import { HTTP_STATUS } from "~/api/http-status";
import { AUTH_NO_STORE } from "~/auth/guest-only.server";
import { authPath } from "~/auth/referer";
import { BookingsList } from "~/booking/bookings-list";
import { parseBookingListStatus } from "~/booking/bookings-url";
import { buildPageMetadata } from "~/seo/metadata";
import type { Route } from "./+types/bookings";

export const meta = () =>
  buildPageMetadata({
    title: "Your Bookings | Tripdly",
    description: "View your Tripdly chauffeur bookings.",
    path: "/bookings",
    index: false,
  });

export function headers() {
  return AUTH_NO_STORE;
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const loginRedirect = () =>
    redirect(authPath("/auth", { redirectTo: `${url.pathname}${url.search}` }), {
      headers: AUTH_NO_STORE,
    });

  if (!hasSessionCookie(request.headers.get("Cookie"))) {
    throw loginRedirect();
  }

  try {
    const bookings = await getBookingsByStatus({ request });

    return { bookings: bookings.data, status: parseBookingListStatus(url.searchParams) };
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === HTTP_STATUS.UNAUTHORIZED) {
      throw loginRedirect();
    }

    throw error;
  }
}

export default function BookingsPage({ loaderData }: Route.ComponentProps) {
  return <BookingsList bookings={loaderData.bookings} status={loaderData.status} />;
}
