import { data, type ShouldRevalidateFunctionArgs } from "react-router";

import { ApiRequestError } from "~/api/api.server";
import { searchCars } from "~/api/cars/cars.server";
import { buildSearchSeoContext } from "~/search/search-heading";
import { SearchPage } from "~/search/search-page";
import { parseSearchUrl, toApiSearchParams } from "~/search/search-url";
import { buildPageMetadata, SITE_ORIGIN } from "~/seo/metadata";
import type { Route } from "./+types/search";

const SEARCH_CACHE_CONTROL = "public, max-age=60, stale-while-revalidate=300";

export function meta({ loaderData, location }: Route.MetaArgs) {
  const query = parseSearchUrl(new URLSearchParams(location.search));
  const { titleParts, descriptionContext } = buildSearchSeoContext({
    vehicleTypes: query.vehicleTypes,
    serviceTiers: query.serviceTiers,
    bookingType: query.bookingType,
  });
  const title =
    titleParts.length > 0
      ? `${titleParts.join(" ")} in Lagos | Tripdly`
      : "Search Available Cars in Lagos, Nigeria | Tripdly";
  const description = descriptionContext
    ? `Find and book ${descriptionContext} with professional drivers in Lagos, Nigeria. Browse our selection of luxury cars for day trips, airport pickups, and special events.`
    : "Search and book available luxury vehicles with professional drivers in Nigeria. Filter by date, vehicle type, and service tier. Find the perfect car for your trip.";

  const tags = buildPageMetadata({
    title,
    description,
    path: "/search",
    image: `${SITE_ORIGIN}/og-image.jpg`,
  });

  const pagination = loaderData?.result?.pagination;

  if (pagination?.hasNextPage) {
    const nextParams = new URLSearchParams(location.search);
    nextParams.set("page", String(pagination.page + 1));
    tags.push({ tagName: "link", rel: "next", href: `${SITE_ORIGIN}/search?${nextParams}` });
  }

  if (pagination?.hasPreviousPage) {
    const prevParams = new URLSearchParams(location.search);
    prevParams.set("page", String(pagination.page - 1));
    tags.push({ tagName: "link", rel: "prev", href: `${SITE_ORIGIN}/search?${prevParams}` });
  }

  return tags;
}

export function shouldRevalidate({
  nextUrl,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if (nextUrl.searchParams.get("countOnly") === "1") {
    return false;
  }

  return defaultShouldRevalidate;
}

export async function loader({ request }: Route.LoaderArgs) {
  const query = parseSearchUrl(new URL(request.url).searchParams);

  try {
    const response = await searchCars({
      request,
      search: toApiSearchParams(query),
    });

    return data(
      {
        result: response.data,
      },
      {
        headers: {
          "Cache-Control": response.headers.get("Cache-Control") ?? SEARCH_CACHE_CONTROL,
        },
      },
    );
  } catch (error) {
    if (error instanceof ApiRequestError) {
      if (error.kind === "aborted") {
        throw error;
      }

      return data(
        {
          result: null,
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    throw error;
  }
}

export function headers({ loaderHeaders }: Route.HeadersArgs) {
  return loaderHeaders;
}

export default function Search({ loaderData }: Route.ComponentProps) {
  return <SearchPage result={loaderData.result} />;
}
