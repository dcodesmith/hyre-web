import type { LoaderFunctionArgs } from "react-router";
import { prisma } from "~/modules/db/db.server";
import { listPublicPartnersForSitemap } from "~/services/partners.server";
import { generateCarSlug } from "~/utils/seo";
import { env } from "~/utils/server/env.server";

/**
 * Dynamic XML Sitemap Generator
 * Generates a sitemap with all public pages and approved cars
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const domain = env.DOMAIN || "https://tripdly.com";

  const [cars, partners] = await Promise.all([
    // Fetch all approved and available cars for individual car pages
    prisma.car.findMany({
      where: {
        status: "AVAILABLE",
        approvalStatus: "APPROVED",
      },
      select: {
        id: true,
        make: true,
        model: true,
        year: true,
        updatedAt: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    }),
    listPublicPartnersForSitemap(),
  ]);

  // Static pages with their priorities and change frequencies
  const staticPages = [
    { url: "", priority: "1.0", changefreq: "daily" },
    { url: "/search", priority: "0.9", changefreq: "hourly" },
    { url: "/chauffeur-service-lagos", priority: "0.9", changefreq: "weekly" },
    { url: "/about", priority: "0.6", changefreq: "monthly" },
    { url: "/faq", priority: "0.6", changefreq: "monthly" },
    { url: "/referrals", priority: "0.7", changefreq: "weekly" },
    { url: "/terms", priority: "0.3", changefreq: "yearly" },
    { url: "/privacy", priority: "0.3", changefreq: "yearly" },
    { url: "/cookies", priority: "0.3", changefreq: "yearly" },
  ];

  const currentDate = new Date().toISOString();

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  ${staticPages
    .map(
      (page) => `
  <url>
    <loc>${domain}${page.url}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`,
    )
    .join("")}
  ${cars
    .map(
      (car) => `
  <url>
    <loc>${domain}/cars/${generateCarSlug(car)}</loc>
    <lastmod>${car.updatedAt.toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`,
    )
    .join("")}
  ${partners
    .map(
      (partner) => `
  <url>
    <loc>${domain}/partners/${encodeURIComponent(partner.publicSlug)}</loc>
    <lastmod>${partner.lastModifiedAt.toISOString()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.85</priority>
  </url>`,
    )
    .join("")}
</urlset>`.trim();

  return new Response(sitemap, {
    status: 200,
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
