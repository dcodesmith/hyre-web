import type { LoaderFunctionArgs } from "react-router";
import { env } from "~/utils/server/env.server";

/**
 * Dynamic robots.txt Generator
 * Controls search engine crawler behavior
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const domain = env.DOMAIN || "https://tripdly.com";

  const robotsTxt = `# Tripdly - Premium Chauffeur Service
# https://tripdly.com

User-agent: *
Allow: /
Allow: /search
Allow: /cars/
Allow: /partners/
Allow: /partners/*/cars/

# Disallow admin and private areas
Disallow: /admin
Disallow: /admin/
Disallow: /fleet-owner
Disallow: /fleet-owner/
Disallow: /api/
Disallow: /profile
Disallow: /bookings
Disallow: /logout
Disallow: /verify
Disallow: /debug*

# Disallow query parameters that create duplicate content
Disallow: /*?*sort=
# Keep partner search result URLs out of index; partner landing pages are canonical entry points.
Disallow: /partners/*/search
Disallow: /partners/*/search?*

# Sitemaps
Sitemap: ${domain}/sitemap.xml

# Common crawlers
User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

User-agent: Slurp
Allow: /

User-agent: DuckDuckBot
Allow: /

User-agent: facebookexternalhit
Allow: /

User-agent: Twitterbot
Allow: /

User-agent: LinkedInBot
Allow: /
`;

  return new Response(robotsTxt, {
    status: 200,
    headers: {
      "Content-Type": "text/plain",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
