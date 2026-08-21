import type { MetaDescriptor } from "react-router";

export const SITE_NAME = "Tripdly";
export const SITE_ORIGIN = "https://tripdly.com";

const STATIC_PAGE_CACHE_CONTROL =
  "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800";

interface PageMetadata {
  readonly title: string;
  readonly description: string;
  readonly path: `/${string}`;
  readonly image?: string;
  readonly index?: boolean;
}

export function buildPageMetadata({
  title,
  description,
  path,
  image,
  index = true,
}: PageMetadata): MetaDescriptor[] {
  const canonical = `${SITE_ORIGIN}${path}`;
  const safeDescription = truncateDescription(description);

  const metadata: MetaDescriptor[] = [
    { title },
    { name: "description", content: safeDescription },
    { name: "robots", content: index ? "index, follow" : "noindex, nofollow" },
    { property: "og:title", content: title },
    { property: "og:description", content: safeDescription },
    { property: "og:url", content: canonical },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:locale", content: "en_NG" },
    { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: safeDescription },
    { tagName: "link", rel: "canonical", href: canonical },
  ];

  if (image) {
    const imageUrl = new URL(image, SITE_ORIGIN).href;
    metadata.push(
      { property: "og:image", content: imageUrl },
      { name: "twitter:image", content: imageUrl },
    );
  }

  return metadata;
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
