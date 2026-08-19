import { data } from "react-router";

import { ApiRequestError } from "~/api/api.server";
import { getCarCategories } from "~/api/cars/cars.server";
import { HomePage } from "~/home/home-page";
import { buildPageMetadata, SITE_ORIGIN } from "~/seo/metadata";
import type { Route } from "./+types/home";

const HOME_CACHE_CONTROL = "public, max-age=300, s-maxage=300, stale-while-revalidate=1800";

export const meta = () =>
  buildPageMetadata({
    title: "Car Rental in Lagos with Driver | Chauffeur Service | Tripdly",
    description:
      "Book chauffeur-driven cars in Lagos, Nigeria from verified fleet owners. SUVs, sedans and luxury vehicles for day trips, airport pickups and special events.",
    path: "/",
    image: `${SITE_ORIGIN}/og-image.jpg`,
  });

export const links: Route.LinksFunction = () => [
  {
    rel: "preload",
    href: "/images/hero.webp",
    as: "image",
    type: "image/webp",
    media: "(min-width: 1024px)",
    fetchPriority: "high",
  },
  {
    rel: "preload",
    href: "/images/hero-1200.webp",
    as: "image",
    type: "image/webp",
    media: "(min-width: 768px) and (max-width: 1023px)",
    fetchPriority: "high",
  },
  {
    rel: "preload",
    href: "/images/hero-640.webp",
    as: "image",
    type: "image/webp",
    media: "(max-width: 767px)",
    fetchPriority: "high",
  },
];

export async function loader({ request }: Route.LoaderArgs) {
  try {
    const response = await getCarCategories({ request });

    return data(
      {
        fleet: response.data,
      },
      {
        headers: {
          "Cache-Control": response.headers.get("Cache-Control") ?? HOME_CACHE_CONTROL,
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
          fleet: null,
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

export default function Home({ loaderData }: Route.ComponentProps) {
  return <HomePage fleet={loaderData.fleet} />;
}
