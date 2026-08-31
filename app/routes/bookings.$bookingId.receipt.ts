import { data, redirect } from "react-router";

import { ApiRequestError } from "~/api/api.server";
import { hasSessionCookie } from "~/api/auth/cookie-relay.server";
import { getBookingReceipt } from "~/api/bookings/bookings.server";
import { HTTP_STATUS } from "~/api/http-status";
import { AUTH_NO_STORE } from "~/auth/guest-only.server";
import { authPath } from "~/auth/referer";
import {
  guestBookingClearCookie,
  readGuestBookingSession,
} from "~/booking/guest-booking-session.server";
import type { Route } from "./+types/bookings.$bookingId.receipt";

function loginRedirect(request: Request) {
  const url = new URL(request.url);
  return redirect(authPath("/auth", { redirectTo: `${url.pathname}${url.search}` }), {
    headers: AUTH_NO_STORE,
  });
}

async function guestSessionRedirect(bookingId: string) {
  const headers = new Headers(AUTH_NO_STORE);
  headers.append("Set-Cookie", await guestBookingClearCookie(bookingId));

  return redirect("/bookings/lookup?status=invalid-link", { headers });
}

function receiptErrorResponse(error: ApiRequestError) {
  const headers = new Headers({
    ...AUTH_NO_STORE,
    "Content-Type": "text/plain; charset=utf-8",
  });
  const retryAfter = error.headers.get("retry-after");

  if (retryAfter) {
    headers.set("Retry-After", retryAfter);
  }

  return new Response(
    error.status < HTTP_STATUS.INTERNAL_SERVER_ERROR
      ? error.problem.detail
      : "The receipt could not be downloaded. Please try again.",
    { status: error.status, headers },
  );
}

async function streamReceipt(upstream: Response) {
  const contentType = upstream.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();

  if (contentType !== "application/pdf") {
    await upstream.body?.cancel();
    return new Response("The receipt could not be downloaded. Please try again.", {
      status: HTTP_STATUS.BAD_GATEWAY,
      headers: {
        ...AUTH_NO_STORE,
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }

  const headers = new Headers({
    "Cache-Control": "private, no-store",
    "Content-Type": "application/pdf",
  });
  const contentDisposition = upstream.headers.get("content-disposition");
  const contentLength = upstream.headers.get("content-length");

  if (contentDisposition && /^attachment(?:;|$)/i.test(contentDisposition)) {
    headers.set("Content-Disposition", contentDisposition);
  } else {
    headers.set("Content-Disposition", 'attachment; filename="Tripdly-receipt.pdf"');
  }
  if (contentLength && /^(0|[1-9]\d*)$/.test(contentLength)) {
    headers.set("Content-Length", contentLength);
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}

export async function loader({ request, params }: Route.LoaderArgs) {
  if (!params.bookingId) {
    throw data(null, { status: HTTP_STATUS.NOT_FOUND, headers: AUTH_NO_STORE });
  }

  let accountError: ApiRequestError | undefined;

  if (hasSessionCookie(request.headers.get("Cookie"))) {
    try {
      return streamReceipt(await getBookingReceipt({ request, bookingId: params.bookingId }));
    } catch (error) {
      if (!(error instanceof ApiRequestError) || error.kind === "aborted") {
        throw error;
      }

      if (error.status !== HTTP_STATUS.UNAUTHORIZED && error.status !== HTTP_STATUS.NOT_FOUND) {
        return receiptErrorResponse(error);
      }

      accountError = error;
    }
  }

  const guestSession = await readGuestBookingSession(request, params.bookingId);

  if (guestSession) {
    try {
      return streamReceipt(
        await getBookingReceipt({
          request,
          bookingId: params.bookingId,
          guestToken: guestSession.token,
        }),
      );
    } catch (error) {
      if (!(error instanceof ApiRequestError) || error.kind === "aborted") {
        throw error;
      }

      if (error.status === HTTP_STATUS.BAD_REQUEST || error.status === HTTP_STATUS.NOT_FOUND) {
        throw await guestSessionRedirect(params.bookingId);
      }

      return receiptErrorResponse(error);
    }
  }

  if (accountError) {
    if (accountError.status === HTTP_STATUS.UNAUTHORIZED) {
      throw loginRedirect(request);
    }

    if (accountError.status === HTTP_STATUS.NOT_FOUND) {
      throw data(null, { status: HTTP_STATUS.NOT_FOUND, headers: AUTH_NO_STORE });
    }
  }

  throw loginRedirect(request);
}
