import { redirect } from "react-router";

import { ApiRequestError } from "~/api/api.server";
import { getGuestBooking } from "~/api/bookings/bookings.server";
import { guestBookingAccessTokenSchema } from "~/api/bookings/schema";
import { HTTP_STATUS } from "~/api/http-status";
import {
  createGuestBookingSession,
  guestBookingSetCookie,
} from "~/booking/guest-booking-session.server";
import type { Route } from "./+types/bookings.guest";

const SENSITIVE_NO_STORE = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
};

function lookupRedirect(status: "invalid-link" | "unavailable") {
  return redirect(`/bookings/lookup?status=${status}`, { headers: SENSITIVE_NO_STORE });
}

export async function loader({ request }: Route.LoaderArgs) {
  const parsed = guestBookingAccessTokenSchema.safeParse(
    new URL(request.url).searchParams.get("token"),
  );

  if (!parsed.success) {
    throw lookupRedirect("invalid-link");
  }

  let response: Awaited<ReturnType<typeof getGuestBooking>>;

  try {
    response = await getGuestBooking({ request, token: parsed.data });
  } catch (error) {
    if (error instanceof ApiRequestError && error.kind === "aborted") {
      throw error;
    }

    throw lookupRedirect(
      error instanceof ApiRequestError &&
        (error.status === HTTP_STATUS.BAD_REQUEST || error.status === HTTP_STATUS.NOT_FOUND)
        ? "invalid-link"
        : "unavailable",
    );
  }

  const expiresAt = Date.parse(response.data.accessExpiresAt);

  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    throw lookupRedirect("invalid-link");
  }

  let setCookie: string;

  try {
    const session = createGuestBookingSession({
      bookingId: response.data.bookingId,
      token: parsed.data,
      accessExpiresAt: response.data.accessExpiresAt,
    });
    setCookie = await guestBookingSetCookie(session);
  } catch {
    throw lookupRedirect("unavailable");
  }

  const headers = new Headers(SENSITIVE_NO_STORE);
  headers.append("Set-Cookie", setCookie);

  throw redirect(`/bookings/${encodeURIComponent(response.data.bookingId)}`, { headers });
}
