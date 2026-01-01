/**
 * SEO Utility Functions
 * Helper functions for generating meta tags and SEO-related content
 */

import type { MetaDescriptor } from "@remix-run/node";

interface MetaTagsOptions {
  title: string;
  description: string;
  url: string;
  image?: string;
  type?: "website" | "article";
  keywords?: string[];
  noindex?: boolean;
  canonical?: string;
  publishedTime?: string;
  modifiedTime?: string;
  geoRegion?: string;
  geoPlacename?: string;
  geoPosition?: string;
  author?: string;
}

/**
 * Generate comprehensive meta tags for a page
 */
export function generateMetaTags(options: MetaTagsOptions): MetaDescriptor[] {
  const {
    title,
    description,
    url,
    image,
    type = "website",
    keywords,
    noindex = false,
    canonical,
    publishedTime,
    modifiedTime,
    geoRegion,
    geoPlacename,
    geoPosition,
    author,
  } = options;

  const tags: MetaDescriptor[] = [
    { title },
    { name: "description", content: description },

    // Open Graph
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:url", content: url },
    { property: "og:type", content: type },
    { property: "og:site_name", content: "Tripdly" },
    { property: "og:locale", content: "en_NG" },

    // Twitter Card
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
  ];

  // Add image tags if provided
  if (image) {
    tags.push(
      { property: "og:image", content: image },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:image", content: image },
    );
  }

  // Add keywords if provided
  if (keywords?.length) {
    tags.push({ name: "keywords", content: keywords.join(", ") });
  }

  // Add robots directive
  if (noindex) {
    tags.push({ name: "robots", content: "noindex, nofollow" });
  } else {
    tags.push({ name: "robots", content: "index, follow" });
  }

  // Add canonical URL
  if (canonical) {
    tags.push({ tagName: "link", rel: "canonical", href: canonical });
  }

  // Add geo tags if provided
  if (geoRegion) {
    tags.push({ name: "geo.region", content: geoRegion });
  }
  if (geoPlacename) {
    tags.push({ name: "geo.placename", content: geoPlacename });
  }
  if (geoPosition) {
    tags.push({ name: "geo.position", content: geoPosition });
  }

  // Add author if provided
  if (author) {
    tags.push({ name: "author", content: author });
  }

  // Add article-specific tags
  if (type === "article") {
    if (publishedTime) {
      tags.push({ property: "article:published_time", content: publishedTime });
    }
    if (modifiedTime) {
      tags.push({ property: "article:modified_time", content: modifiedTime });
    }
  }

  return tags;
}

/**
 * Generate domain URL from environment
 */
export function getDomain(env?: { DOMAIN?: string }): string {
  if (globalThis.window !== undefined) {
    return globalThis.window.ENV?.DOMAIN || "https://tripdly.com";
  }
  return env?.DOMAIN || "https://tripdly.com";
}

/**
 * Build base URL with protocol detection for localhost
 * Detects localhost/127.0.0.1 and uses http://, otherwise uses https://
 */
export function getBaseUrl(domain: string | null | undefined = "tripdly.com"): string {
  const effectiveDomain = domain ?? "tripdly.com";
  const isLocalhost =
    effectiveDomain.includes("localhost") || effectiveDomain.includes("127.0.0.1");
  return isLocalhost ? `http://${effectiveDomain}` : `https://${effectiveDomain}`;
}

/**
 * Generate SEO-friendly slug from text
 */
export function generateSlug(text: string): string {
  let slug = text
    .toLowerCase()
    .replaceAll(/[^\w\s-]/g, "")
    .replaceAll(/[\s_-]+/g, "-")
    .replaceAll(/^-+/g, ""); // Remove leading hyphens

  // Remove trailing hyphens using string method to avoid ReDoS
  while (slug.endsWith("-")) {
    slug = slug.slice(0, -1);
  }

  return slug;
}

/**
 * Truncate text for meta descriptions (recommended 150-160 chars)
 * Truncates at word boundary to avoid awkward mid-word cuts
 */
export function truncateDescription(text: string, maxLength = 155): string {
  if (text.length <= maxLength) return text;

  const truncated = text.substring(0, maxLength - 3);
  const lastSpace = truncated.lastIndexOf(" ");

  // Fall back to hard truncation if no space found (single long word)
  const cleanTruncation = lastSpace > 0 ? truncated.substring(0, lastSpace) : truncated;

  return `${cleanTruncation.trim()}...`;
}

/**
 * Generate page title with site name
 */
export function generatePageTitle(pageTitle: string, siteName = "Tripdly"): string {
  if (pageTitle.toLowerCase().includes(siteName.toLowerCase())) {
    return pageTitle;
  }
  return `${pageTitle} | ${siteName}`;
}

/**
 * Default SEO keywords for chauffeur service
 */
export const defaultKeywords = [
  "chauffeur service Nigeria",
  "luxury car hire Lagos",
  "luxury chauffeur service Nigeria",
  "premium chauffeur service Lagos",
  "premium chauffeur Lagos",
  "executive car service Abuja",
  "airport transfer Nigeria",
  "corporate car hire",
  "professional driver service",
  "VIP transport Nigeria",
  "wedding car hire Lagos",
  "business travel Nigeria",
];

/**
 * Location-specific keywords generator
 */
export function getLocationKeywords(city: string): string[] {
  const baseServices = [
    "chauffeur service",
    "car hire",
    "airport transfer",
    "executive car",
    "luxury vehicle hire",
    "corporate transport",
  ];

  return baseServices.map((service) => `${service} ${city}`);
}

/**
 * Vehicle-specific keywords generator
 */
export function getVehicleKeywords(make: string, model: string, type: string): string[] {
  return [
    `${make} ${model} chauffeur`,
    `${make} car hire Nigeria`,
    `${type} chauffeur service`,
    `${make} ${model} rental Lagos`,
    `luxury ${make} hire`,
  ];
}

/**
 * Generate structured data for vehicle rental offer
 */
export function generateVehicleOfferData(car: {
  id: string;
  make: string;
  model: string;
  year: number;
  color: string;
  dayRate: number;
  vehicleType: string;
  passengerCapacity: number;
  status: string;
  images?: Array<{ url: string }>;
}) {
  const domain = "https://tripdly.com";
  const imageUrl = car.images?.[0]?.url || `${domain}/images/default-car.webp`;
  const slug = generateCarSlug({ id: car.id, make: car.make, model: car.model, year: car.year });

  return {
    name: `${car.year} ${car.make} ${car.model}`,
    description: `Book a ${car.color} ${car.year} ${car.make} ${car.model} with professional chauffeur service in Nigeria. ${car.vehicleType} with ${car.passengerCapacity} passenger capacity.`,
    image: imageUrl,
    url: `${domain}/cars/${slug}`,
    brand: car.make,
    model: car.model,
    year: car.year,
    color: car.color,
    seatingCapacity: car.passengerCapacity,
    vehicleType: car.vehicleType,
    offers: {
      price: car.dayRate,
      priceCurrency: "NGN",
      availability: car.status === "AVAILABLE" ? "InStock" : "OutOfStock",
    },
  };
}

/**
 * Generate SEO-friendly slug for a car
 * Format: {year}-{make}-{model}-{shortId}
 * Example: 2023-toyota-camry-cmiiyvz
 */
export function generateCarSlug(car: {
  id: string;
  make: string;
  model: string;
  year: number;
}): string {
  const shortId = car.id.slice(0, 7);
  let slug = `${car.year}-${car.make}-${car.model}`
    .toLowerCase()
    .replaceAll(/[^\w\s-]/g, "") // Remove special characters
    .replaceAll(/[\s_]+/g, "-") // Replace spaces/underscores with hyphens
    .replaceAll(/-+/g, "-") // Replace multiple hyphens with single
    .replaceAll(/^-+/g, ""); // Remove leading hyphens

  // Remove trailing hyphens using string method to avoid ReDoS
  while (slug.endsWith("-")) {
    slug = slug.slice(0, -1);
  }

  return `${slug}-${shortId}`;
}

/**
 * Extract the car ID from a slug
 * The ID is the last 7 characters after the final hyphen
 * Returns null if the slug format is invalid
 */
export function extractCarIdFromSlug(slug: string): string | null {
  // Check if it's a raw CUID (starts with 'c' and is 25 chars)
  if (/^c[a-z0-9]{24}$/i.test(slug)) {
    return slug;
  }

  // Extract the short ID from the end of the slug
  const regex = /-([a-z0-9]{7})$/i;
  const match = regex.exec(slug);
  if (match) {
    return match[1]; // Return the short ID to search with startsWith
  }

  return null;
}

/**
 * Generate the full car URL with slug
 */
export function getCarUrl(
  car: { id: string; make: string; model: string; year: number },
  baseUrl = "https://tripdly.com",
): string {
  const slug = generateCarSlug(car);
  return `${baseUrl}/cars/${slug}`;
}

/**
 * Company information for structured data
 */
export const companyInfo = {
  name: "Tripdly",
  legalName: "Tripdly Limited",
  url: "https://tripdly.com",
  logo: "https://tripdly.com/logo.svg",
  description:
    "Premium chauffeur and luxury car hire service in Nigeria. Professional drivers, executive vehicles, and seamless booking for corporate travel, airport transfers, and special occasions.",
  email: "hello@tripdly.com",
  phone: "+234 800 000 0000", // Update with actual phone
  address: {
    streetAddress: "Victoria Island", // Update with actual address
    city: "Lagos",
    state: "Lagos",
    country: "NG",
    postalCode: "101233",
  },
  geo: {
    latitude: 6.4281,
    longitude: 3.4219,
  },
  priceRange: "₦₦₦",
  areaServed: ["Lagos", "Abuja", "Port Harcourt", "Ibadan", "Kano"],
  sameAs: [
    "https://twitter.com/tripdly",
    "https://instagram.com/tripdly",
    "https://facebook.com/tripdly",
    "https://linkedin.com/company/tripdly",
  ],
};
