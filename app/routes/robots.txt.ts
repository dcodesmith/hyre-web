import { env } from "cloudflare:workers";

import { PRIVATE_PATH_PREFIXES } from "~/middleware/security.server";
import { SITE_ORIGIN } from "~/seo/metadata";
import { buildRobotsTxt } from "~/seo/robots";

const ROBOTS_CACHE_CONTROL = "public, max-age=86400, s-maxage=86400";

export function loader() {
  return new Response(
    buildRobotsTxt({
      origin: SITE_ORIGIN,
      allowIndexing: env.APP_ENV === "production",
      privatePaths: PRIVATE_PATH_PREFIXES,
    }),
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": ROBOTS_CACHE_CONTROL,
      },
    },
  );
}
