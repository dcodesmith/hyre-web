export const SITEMAP_SEARCH_PAGE_SIZE = 50;
export const SITEMAP_MAX_PAGES = 20;

export const SITEMAP_STATIC_PATHS = [
  "/",
  "/search",
  "/about",
  "/faq",
  "/terms",
  "/privacy",
  "/cookies",
] as const;

const XML_ESCAPE_PATTERN = /[&<>"']/g;
const XML_ESCAPE_CHARS: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

export function remainingSitemapPages(totalPages: number) {
  const last = Math.min(Math.max(totalPages, 0), SITEMAP_MAX_PAGES);

  if (last <= 1) {
    return [];
  }

  return Array.from({ length: last - 1 }, (_, index) => index + 2);
}

export function sitemapSearchParams(page: number) {
  return new URLSearchParams({
    page: String(page),
    limit: String(SITEMAP_SEARCH_PAGE_SIZE),
  });
}

export async function collectPublicSitemapCars<T extends { id: string }>({
  searchPage,
  isAbortError,
}: {
  searchPage: (page: number) => Promise<{ cars: readonly T[]; totalPages: number }>;
  isAbortError: (error: unknown) => boolean;
}): Promise<T[]> {
  const first = await searchPage(1);
  const cars = [...first.cars];
  const rest = await Promise.all(
    remainingSitemapPages(first.totalPages).map(async (page) => {
      try {
        return await searchPage(page);
      } catch (error) {
        if (isAbortError(error)) {
          throw error;
        }

        return undefined;
      }
    }),
  );

  for (const page of rest) {
    if (page) {
      cars.push(...page.cars);
    }
  }

  return uniqueSitemapCars(cars);
}

export function uniqueSitemapCars<T extends { id: string }>(cars: readonly T[]) {
  const seen = new Set<string>();

  return cars.filter((car) => {
    if (seen.has(car.id)) {
      return false;
    }

    seen.add(car.id);
    return true;
  });
}

export function sitemapLoc(origin: string, path: string) {
  return path === "/" ? `${origin}/` : `${origin}${path}`;
}

export function buildSitemapXml(locs: readonly string[]) {
  const urls = locs.map((loc) => `  <url>\n    <loc>${escapeXml(loc)}</loc>\n  </url>`).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function escapeXml(value: string) {
  return value.replace(XML_ESCAPE_PATTERN, (char) => XML_ESCAPE_CHARS[char] ?? char);
}
