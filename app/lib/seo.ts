import type { MetaDescriptor } from "react-router";

export const SITE_NAME = "Tripdly";
export const SITE_ORIGIN = "https://tripdly.com";

const STATIC_PAGE_CACHE_CONTROL =
  "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800";

interface PageMetadata {
  readonly title: string;
  readonly description: string;
  readonly path: `/${string}`;
}

export function buildPageMetadata({ title, description, path }: PageMetadata): MetaDescriptor[] {
  const canonical = `${SITE_ORIGIN}${path}`;
  const safeDescription = truncateDescription(description);

  return [
    { title },
    { name: "description", content: safeDescription },
    { name: "robots", content: "index, follow" },
    { property: "og:title", content: title },
    { property: "og:description", content: safeDescription },
    { property: "og:url", content: canonical },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:locale", content: "en_NG" },
    { name: "twitter:card", content: "summary" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: safeDescription },
    { tagName: "link", rel: "canonical", href: canonical },
  ];
}

export function staticPageHeaders() {
  return {
    "Cache-Control": STATIC_PAGE_CACHE_CONTROL,
  };
}

function truncateDescription(description: string, maxLength = 155) {
  if (description.length <= maxLength) {
    return description;
  }

  const candidate = description.slice(0, maxLength - 3);
  const lastSpace = candidate.lastIndexOf(" ");
  const truncated = lastSpace > 0 ? candidate.slice(0, lastSpace) : candidate;

  return `${truncated.trim()}...`;
}
