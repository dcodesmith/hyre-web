import { data, redirect, type ShouldRevalidateFunctionArgs } from "react-router";
import { z } from "zod";

import { ApiRequestError } from "~/api/api.server";
import { hasSessionCookie } from "~/api/auth/cookie-relay.server";
import {
  cancelBooking,
  getBookingById,
  getGuestBooking,
  updateBooking,
} from "~/api/bookings/bookings.server";
import type { BookingDetail } from "~/api/bookings/schema";
import { HTTP_STATUS } from "~/api/http-status";
import { createReview, updateReview } from "~/api/reviews/reviews.server";
import { AUTH_NO_STORE } from "~/auth/guest-only.server";
import { authPath } from "~/auth/referer";
import { readAuthSessionUser } from "~/auth/session.server";
import type { BookingCancelActionData } from "~/booking/booking-cancel";
import { cancelBookingFormSchema } from "~/booking/booking-cancel-form-schema";
import { BookingDetailPage } from "~/booking/booking-detail";
import type { BookingModifyActionData } from "~/booking/booking-modify";
import { bookingModifyFormSchema } from "~/booking/booking-modify-form-schema";
import { guestBookingAsDetail } from "~/booking/guest-booking";
import {
  guestBookingClearCookie,
  readGuestBookingSession,
} from "~/booking/guest-booking-session.server";
import type { BookingReviewActionData, BookingReviewAvailability } from "~/review/booking-review";
import { reviewFormSchema } from "~/review/review-form-schema";
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

const REVIEW_CREATION_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

function getCustomerReviewAvailability(
  isBookingCustomer: boolean,
  reviewVisibility: boolean | null,
  booking: Pick<BookingDetail, "chauffeur" | "endDate" | "review">,
  now: string,
): BookingReviewAvailability {
  if (!isBookingCustomer) {
    return "hidden";
  }

  if (reviewVisibility === false) {
    return "moderated";
  }

  if (booking.review) {
    return "available";
  }

  if (!booking.chauffeur) {
    return "unavailable";
  }

  const endDate = Date.parse(booking.endDate);
  const currentTime = Date.parse(now);

  return Number.isFinite(endDate) &&
    Number.isFinite(currentTime) &&
    endDate < currentTime - REVIEW_CREATION_WINDOW_MS
    ? "creation-expired"
    : "available";
}

export async function loader({ request, params }: Route.LoaderArgs) {
  if (!params.bookingId) {
    throw data(null, { status: HTTP_STATUS.NOT_FOUND });
  }

  let accountError: unknown;

  if (hasSessionCookie(request.headers.get("Cookie"))) {
    try {
      const [booking, sessionUser] = await Promise.all([
        getBookingById({ request, bookingId: params.bookingId }),
        readAuthSessionUser(request),
      ]);
      const now = new Date().toISOString();
      const isBookingCustomer =
        booking.data.customerUserId !== null && sessionUser?.id === booking.data.customerUserId;

      return {
        accessMode: "account" as const,
        booking: booking.data.booking,
        canDownloadReceipt: isBookingCustomer,
        reviewAvailability: getCustomerReviewAvailability(
          isBookingCustomer,
          booking.data.reviewVisibility,
          booking.data.booking,
          now,
        ),
        now,
      };
    } catch (error) {
      accountError = error;

      if (
        !(error instanceof ApiRequestError) ||
        (error.status !== HTTP_STATUS.UNAUTHORIZED && error.status !== HTTP_STATUS.NOT_FOUND)
      ) {
        throw error;
      }
    }
  }

  const guestSession = await readGuestBookingSession(request, params.bookingId);

  if (guestSession) {
    try {
      const booking = await getGuestBooking({ request, token: guestSession.token });

      if (booking.data.bookingId !== params.bookingId) {
        throw await guestSessionRedirect(params.bookingId);
      }

      return {
        accessMode: "guest" as const,
        booking: guestBookingAsDetail(booking.data),
        canDownloadReceipt: true,
        reviewAvailability: "hidden" as const,
        now: new Date().toISOString(),
      };
    } catch (error) {
      if (
        error instanceof Response ||
        (error instanceof ApiRequestError && error.kind === "aborted")
      ) {
        throw error;
      }

      if (
        error instanceof ApiRequestError &&
        (error.status === HTTP_STATUS.BAD_REQUEST || error.status === HTTP_STATUS.NOT_FOUND)
      ) {
        throw await guestSessionRedirect(params.bookingId);
      }

      throw error;
    }
  }

  if (accountError instanceof ApiRequestError) {
    if (accountError.status === HTTP_STATUS.UNAUTHORIZED) {
      throw loginRedirect(request);
    }

    if (accountError.status === HTTP_STATUS.NOT_FOUND) {
      throw data(null, { status: HTTP_STATUS.NOT_FOUND });
    }
  }

  throw loginRedirect(request);
}

async function guestSessionRedirect(bookingId: string) {
  const headers = new Headers(AUTH_NO_STORE);
  headers.append("Set-Cookie", await guestBookingClearCookie(bookingId));

  return redirect("/bookings/lookup?status=invalid-link", { headers });
}

export async function action({ request, params }: Route.ActionArgs) {
  if (!params.bookingId) {
    throw data(null, { status: HTTP_STATUS.NOT_FOUND });
  }

  if (!hasSessionCookie(request.headers.get("Cookie"))) {
    throw loginRedirect(request);
  }

  const formData = await request.formData();
  const form = Object.fromEntries(formData);

  if (form.intent === "cancel") {
    return handleCancel(request, params.bookingId, form);
  }

  if (form.intent === "modify") {
    return handleModify(request, params.bookingId, form);
  }

  if (form.intent === "create-review" || form.intent === "update-review") {
    return handleReview(request, params.bookingId, form);
  }

  return data<BookingModifyActionData>(
    { error: "This booking action is not supported.", revalidate: false },
    { status: HTTP_STATUS.BAD_REQUEST, headers: AUTH_NO_STORE },
  );
}

async function handleCancel(
  request: Request,
  bookingId: string,
  form: Record<string, FormDataEntryValue>,
) {
  const parsed = cancelBookingFormSchema.safeParse(form);

  if (!parsed.success) {
    return data<BookingCancelActionData>(
      { error: "This booking cannot be cancelled." },
      { status: HTTP_STATUS.BAD_REQUEST, headers: AUTH_NO_STORE },
    );
  }

  try {
    await cancelBooking({ request, bookingId });
  } catch (error) {
    const failure = getBookingActionFailure(
      error,
      request,
      "Failed to cancel booking. Please try again.",
    );

    return data<BookingCancelActionData>(
      { error: failure.message },
      {
        status: failure.status,
        headers: AUTH_NO_STORE,
      },
    );
  }

  return data<BookingCancelActionData>({ ok: true }, { headers: AUTH_NO_STORE });
}

async function handleModify(
  request: Request,
  bookingId: string,
  form: Record<string, FormDataEntryValue>,
) {
  const parsed = bookingModifyFormSchema.safeParse(form);

  if (!parsed.success) {
    return data<BookingModifyActionData>(
      { fieldErrors: z.flattenError(parsed.error).fieldErrors, revalidate: false },
      { status: HTTP_STATUS.BAD_REQUEST, headers: AUTH_NO_STORE },
    );
  }

  try {
    await updateBooking({ request, bookingId, body: parsed.data });
  } catch (error) {
    const failure = getBookingActionFailure(
      error,
      request,
      "Failed to update booking. Please try again.",
    );

    return data<BookingModifyActionData>(
      { error: failure.message },
      { status: failure.status, headers: AUTH_NO_STORE },
    );
  }

  return data<BookingModifyActionData>({ ok: true }, { headers: AUTH_NO_STORE });
}

async function handleReview(
  request: Request,
  bookingId: string,
  form: Record<string, FormDataEntryValue>,
) {
  const parsed = reviewFormSchema.safeParse(form);

  if (!parsed.success) {
    return data<BookingReviewActionData>(
      {
        fieldErrors: z.flattenError(parsed.error).fieldErrors,
        revalidate: false,
      },
      { status: HTTP_STATUS.BAD_REQUEST, headers: AUTH_NO_STORE },
    );
  }

  try {
    const ratings = {
      overallRating: parsed.data.overallRating,
      carRating: parsed.data.carRating,
      chauffeurRating: parsed.data.chauffeurRating,
      serviceRating: parsed.data.serviceRating,
    };

    if (parsed.data.intent === "create-review") {
      await createReview({
        request,
        body: { bookingId, ...ratings, comment: parsed.data.comment },
      });
    } else {
      await updateReview({
        request,
        reviewId: parsed.data.reviewId,
        body: { ...ratings, comment: parsed.data.comment },
      });
    }
  } catch (error) {
    const failure = getBookingActionFailure(
      error,
      request,
      parsed.data.intent === "create-review"
        ? "Failed to submit review. Please try again."
        : "Failed to update review. Please try again.",
    );

    return data<BookingReviewActionData>(
      { error: failure.message },
      { status: failure.status, headers: AUTH_NO_STORE },
    );
  }

  return data<BookingReviewActionData>(
    {
      ok: true,
      operation: parsed.data.intent === "create-review" ? "created" : "updated",
    },
    { headers: AUTH_NO_STORE },
  );
}

function getBookingActionFailure(error: unknown, request: Request, fallback: string) {
  if (error instanceof ApiRequestError && error.status === HTTP_STATUS.UNAUTHORIZED) {
    throw loginRedirect(request);
  }

  if (error instanceof ApiRequestError && error.kind === "aborted") {
    throw error;
  }

  return {
    message:
      error instanceof ApiRequestError && error.status < HTTP_STATUS.INTERNAL_SERVER_ERROR
        ? error.problem.detail
        : fallback,
    status: error instanceof ApiRequestError ? error.status : HTTP_STATUS.BAD_GATEWAY,
  };
}

export function shouldRevalidate({
  actionResult,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if (
    (actionResult as BookingModifyActionData | BookingReviewActionData | undefined)?.revalidate ===
    false
  ) {
    return false;
  }

  return defaultShouldRevalidate;
}

export default function BookingDetailRoute({ loaderData }: Route.ComponentProps) {
  return (
    <BookingDetailPage
      accessMode={loaderData.accessMode}
      booking={loaderData.booking}
      canDownloadReceipt={loaderData.canDownloadReceipt}
      reviewAvailability={loaderData.reviewAvailability}
      now={loaderData.now}
    />
  );
}
