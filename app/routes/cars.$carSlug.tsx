import { data, redirect, type ShouldRevalidateFunctionArgs } from "react-router";

import { ApiRequestError } from "~/api/api.server";
import { getPublicCar } from "~/api/cars/cars.server";
import { getCarReviews } from "~/api/reviews/reviews.server";
import { CarDetailPage } from "~/car/car-detail-page";
import { formatNaira } from "~/car/car-domain";
import { CAR_REVIEWS_LIMIT, parseCarDetailUrl, shouldRevalidateCarDetail } from "~/car/car-url";
import { extractCarIdFromSlug, generateCarSlug } from "~/car/paths";
import { vehicleTypeLabels } from "~/search/search-url";
import { buildPageMetadata, SITE_ORIGIN } from "~/seo/metadata";
import type { Route } from "./+types/cars.$carSlug";

const CAR_CACHE_CONTROL = "public, max-age=60, stale-while-revalidate=300";

function isMissingCar(error: unknown) {
  return (
    error instanceof ApiRequestError &&
    error.kind === "http" &&
    (error.status === 404 || error.status === 400)
  );
}

export function meta({ loaderData }: Route.MetaArgs) {
  const { car } = loaderData;
  const carName = `${car.make} ${car.model} ${car.year}`;
  const colorPrefix = car.color ? `${car.color} ` : "";
  const vehicleTypeLabel = vehicleTypeLabels[car.vehicleType];

  return buildPageMetadata({
    title: `${carName} in Lagos | Tripdly`,
    description: `Book a ${colorPrefix}${carName} with professional chauffeur service in Lagos, Nigeria. ${vehicleTypeLabel} from ${formatNaira(car.dayRate)}/day for trips, airport pickups and events.`,
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
    throw data(null, { status: 404 });
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
    page: query.reviewsPage,
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
      throw data(null, { status: 404 });
    }

    throw error;
  }

  const car = carResponse.data;
  const canonicalSlug = generateCarSlug(car);

  if (params.carSlug !== canonicalSlug) {
    throw redirect(`/cars/${canonicalSlug}${url.search}`, 301);
  }

  return data(
    {
      car,
      reviews: await reviewsPromise,
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

export default function CarDetail({ loaderData }: Route.ComponentProps) {
  return <CarDetailPage car={loaderData.car} reviews={loaderData.reviews} />;
}
