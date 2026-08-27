import { parseWithZod } from "@conform-to/zod/v4";
import { data, redirect, type ShouldRevalidateFunctionArgs } from "react-router";

import { ApiRequestError } from "~/api/api.server";
import { createBooking } from "~/api/bookings/bookings.server";
import { bookingPricingPreviewSchema } from "~/api/bookings/schema";
import { getPublicCar } from "~/api/cars/cars.server";
import { HTTP_STATUS } from "~/api/http-status";
import { getCarReviews } from "~/api/reviews/reviews.server";
import { AUTH_NO_STORE } from "~/auth/guest-only.server";
import { readAuthUser } from "~/auth/session.server";
import { createBookingFormSchema, toCreateBookingBody } from "~/booking/booking-create-form-schema";
import { CarDetailPage } from "~/car/car-detail-page";
import {
  CAR_REVIEWS_LIMIT,
  parseCarDetailUrl,
  parseReviewsPage,
  shouldRevalidateCarDetail,
} from "~/car/car-url";
import { extractCarIdFromSlug, generateCarSlug } from "~/car/paths";
import { formatCurrency } from "~/money/currency";
import {
  createPaymentStatusSession,
  paymentStatusSetCookie,
  requirePaymentStatusCookieSecret,
} from "~/payment/payment-status-session.server";
import { vehicleTypeLabels } from "~/search/search-url";
import { buildPageMetadata, SITE_ORIGIN } from "~/seo/metadata";
import type { Route } from "./+types/cars.$carSlug";

const CAR_CACHE_CONTROL = "public, max-age=60, stale-while-revalidate=300";
const BOOKING_CREATE_ERROR = "Unable to start payment. Please try again.";

function isMissingCar(error: unknown) {
  return (
    error instanceof ApiRequestError &&
    error.kind === "http" &&
    (error.status === HTTP_STATUS.NOT_FOUND || error.status === HTTP_STATUS.BAD_REQUEST)
  );
}

export function meta({ loaderData }: Route.MetaArgs) {
  const { car } = loaderData;
  const carName = `${car.make} ${car.model} ${car.year}`;
  const colorPrefix = car.color ? `${car.color} ` : "";
  const vehicleTypeLabel = vehicleTypeLabels[car.vehicleType];

  return buildPageMetadata({
    title: `${carName} in Lagos | Tripdly`,
    description: `Book a ${colorPrefix}${carName} with professional chauffeur service in Lagos, Nigeria. ${vehicleTypeLabel} from ${formatCurrency(car.dayRate)}/day for trips, airport pickups and events.`,
    path: `/cars/${generateCarSlug(car)}`,
    image: car.images[0]?.url ?? `${SITE_ORIGIN}/og-image.jpg`,
  });
}

export function shouldRevalidate({
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if (currentUrl.pathname !== nextUrl.pathname) {
    return defaultShouldRevalidate;
  }

  return shouldRevalidateCarDetail(currentUrl.searchParams, nextUrl.searchParams);
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const carId = extractCarIdFromSlug(params.carSlug ?? "");

  if (!carId) {
    throw data(null, { status: HTTP_STATUS.NOT_FOUND });
  }

  const url = new URL(request.url);
  const query = parseCarDetailUrl(url.searchParams);
  const carPromise = getPublicCar({
    request,
    carId,
    from: query.search.from,
  });
  const reviewsPromise = getCarReviews({
    request,
    carId,
    page: parseReviewsPage(url.searchParams.get("reviewsPage")),
    limit: CAR_REVIEWS_LIMIT,
    includeRatings: true,
  })
    .then((response) => response.data)
    .catch((error: unknown) => {
      if (error instanceof ApiRequestError && error.kind === "aborted") {
        throw error;
      }

      return null;
    });
  let carResponse: Awaited<typeof carPromise>;

  try {
    carResponse = await carPromise;
  } catch (error) {
    if (error instanceof ApiRequestError && error.kind === "aborted") {
      throw error;
    }

    if (isMissingCar(error)) {
      throw data(null, { status: HTTP_STATUS.NOT_FOUND });
    }

    throw error;
  }

  const car = carResponse.data;
  const canonicalSlug = generateCarSlug(car);

  if (params.carSlug !== canonicalSlug) {
    throw redirect(`/cars/${canonicalSlug}${url.search}`, HTTP_STATUS.MOVED_PERMANENTLY);
  }

  const reviews = await reviewsPromise;

  return data(
    {
      car,
      reviews,
    },
    {
      headers: {
        "Cache-Control": carResponse.headers.get("Cache-Control") ?? CAR_CACHE_CONTROL,
      },
    },
  );
}

export function headers({ loaderHeaders }: Route.HeadersArgs) {
  return loaderHeaders;
}

export async function action({ request, params }: Route.ActionArgs) {
  const carId = extractCarIdFromSlug(params.carSlug ?? "");

  if (!carId) {
    throw data(null, { status: HTTP_STATUS.NOT_FOUND });
  }

  const [user, formData] = await Promise.all([readAuthUser(request), request.formData()]);
  const isSignedIn = user != null;
  const submission = parseWithZod(formData, { schema: createBookingFormSchema(!isSignedIn) });

  if (submission.status !== "success") {
    return data(
      { lastResult: submission.reply(), currentPricing: undefined },
      { status: HTTP_STATUS.BAD_REQUEST, headers: AUTH_NO_STORE },
    );
  }

  if (submission.value.carId !== carId) {
    return data(
      {
        lastResult: submission.reply({ formErrors: ["This car is no longer available."] }),
        currentPricing: undefined,
      },
      { status: HTTP_STATUS.BAD_REQUEST, headers: AUTH_NO_STORE },
    );
  }

  const createBody = toCreateBookingBody(submission.value);

  if (!createBody) {
    return data(
      {
        lastResult: submission.reply({ formErrors: [BOOKING_CREATE_ERROR] }),
        currentPricing: undefined,
      },
      { status: HTTP_STATUS.BAD_REQUEST, headers: AUTH_NO_STORE },
    );
  }

  requirePaymentStatusCookieSecret();

  let created: Awaited<ReturnType<typeof createBooking>>;
  try {
    created = await createBooking({
      request,
      body: {
        ...createBody,
        callbackUrl: new URL("/bookings/payment-status", request.url).toString(),
      },
      idempotencyKey: submission.value.idempotencyKey,
    });
  } catch (error) {
    return bookingCreateFailure(error, (message) => submission.reply({ formErrors: [message] }));
  }

  if (!isSignedIn && !created.data.paymentStatusToken) {
    return data(
      {
        lastResult: submission.reply({ formErrors: [BOOKING_CREATE_ERROR] }),
        currentPricing: undefined,
      },
      { status: HTTP_STATUS.BAD_GATEWAY, headers: AUTH_NO_STORE },
    );
  }

  const paymentSession = createPaymentStatusSession({
    bookingId: created.data.bookingId,
    txRef: created.data.txRef,
    paymentStatusToken: created.data.paymentStatusToken,
    reservationExpiresAt: created.data.reservationExpiresAt,
  });

  throw redirect(created.data.checkoutUrl, {
    headers: { "Set-Cookie": await paymentStatusSetCookie(paymentSession) },
  });
}

function bookingCreateFailure(error: unknown, reply: (message: string) => unknown) {
  if (error instanceof Response) {
    throw error;
  }

  if (!(error instanceof ApiRequestError)) {
    return data(
      {
        lastResult: reply(BOOKING_CREATE_ERROR),
        currentPricing: undefined,
        errorCode: undefined,
        retryAfterSeconds: undefined,
      },
      { status: HTTP_STATUS.BAD_GATEWAY, headers: AUTH_NO_STORE },
    );
  }

  if (error.kind === "aborted") {
    throw error;
  }

  const message =
    error.status < HTTP_STATUS.INTERNAL_SERVER_ERROR ? error.problem.detail : BOOKING_CREATE_ERROR;
  const currentPricing =
    error.problem.errorCode === "BOOKING_PRICE_CHANGED"
      ? bookingPricingPreviewSchema.safeParse(error.problem.details?.currentPricing).data
      : undefined;
  const errorCode = error.problem.errorCode;
  const retryAfterSeconds =
    typeof error.problem.details?.retryAfterSeconds === "number"
      ? error.problem.details.retryAfterSeconds
      : undefined;
  const headers = new Headers(AUTH_NO_STORE);

  for (const name of ["Retry-After", "X-Request-ID"]) {
    const value = error.headers.get(name);
    if (value) {
      headers.set(name, value);
    }
  }

  return data(
    { lastResult: reply(message), currentPricing, errorCode, retryAfterSeconds },
    {
      status: error.status,
      headers,
    },
  );
}

export default function CarDetail({ loaderData, actionData }: Route.ComponentProps) {
  return (
    <CarDetailPage
      car={loaderData.car}
      reviews={loaderData.reviews}
      lastResult={actionData?.lastResult}
      currentPricing={actionData?.currentPricing}
    />
  );
}
