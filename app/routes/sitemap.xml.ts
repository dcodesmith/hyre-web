import { ApiRequestError } from "~/api/api.server";
import { listPublicSitemapCars } from "~/api/cars/cars.server";
import { generateCarSlug } from "~/car/paths";
import { SITE_ORIGIN } from "~/seo/metadata";
import { buildSitemapXml, SITEMAP_STATIC_PATHS, sitemapLoc } from "~/seo/sitemap";
import type { Route } from "./+types/sitemap.xml";

const SITEMAP_CACHE_CONTROL = "public, max-age=3600, s-maxage=3600";

export async function loader({ request }: Route.LoaderArgs) {
  const cars = await loadSitemapCars(request);
  const locs = [
    ...SITEMAP_STATIC_PATHS.map((path) => sitemapLoc(SITE_ORIGIN, path)),
    ...cars.map((car) => sitemapLoc(SITE_ORIGIN, `/cars/${generateCarSlug(car)}`)),
  ];

  return new Response(buildSitemapXml(locs), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": SITEMAP_CACHE_CONTROL,
    },
  });
}

async function loadSitemapCars(request: Request) {
  try {
    return await listPublicSitemapCars({ request });
  } catch (error) {
    if (error instanceof ApiRequestError && error.kind === "aborted") {
      throw error;
    }

    return [];
  }
}
