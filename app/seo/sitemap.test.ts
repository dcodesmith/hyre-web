import { describe, expect, it } from "vitest";

import {
  buildSitemapXml,
  collectPublicSitemapCars,
  remainingSitemapPages,
  SITEMAP_MAX_PAGES,
  SITEMAP_SEARCH_PAGE_SIZE,
  sitemapLoc,
  sitemapSearchParams,
  uniqueSitemapCars,
} from "./sitemap";

describe("remainingSitemapPages", () => {
  it("returns no extra pages for an empty or single-page result", () => {
    expect(remainingSitemapPages(0)).toEqual([]);
    expect(remainingSitemapPages(1)).toEqual([]);
  });

  it("returns page numbers after the first page and caps the window", () => {
    expect(remainingSitemapPages(3)).toEqual([2, 3]);
    expect(remainingSitemapPages(SITEMAP_MAX_PAGES + 5)).toEqual(
      Array.from({ length: SITEMAP_MAX_PAGES - 1 }, (_, index) => index + 2),
    );
  });
});

describe("sitemapSearchParams", () => {
  it("sends only unfiltered page and limit", () => {
    expect(Object.fromEntries(sitemapSearchParams(2))).toEqual({
      page: "2",
      limit: String(SITEMAP_SEARCH_PAGE_SIZE),
    });
  });
});

describe("collectPublicSitemapCars", () => {
  it("keeps successful later pages when another page fails", async () => {
    const cars = await collectPublicSitemapCars({
      searchPage: async (page) => {
        if (page === 3) {
          throw new Error("unavailable");
        }

        return {
          totalPages: 3,
          cars: [{ id: `page-${page}` }],
        };
      },
      isAbortError: () => false,
    });

    expect(cars).toEqual([{ id: "page-1" }, { id: "page-2" }]);
  });

  it("rethrows abort errors from later pages", async () => {
    const abort = new Error("aborted");

    await expect(
      collectPublicSitemapCars({
        searchPage: async (page) => {
          if (page === 3) {
            throw abort;
          }

          return {
            totalPages: 3,
            cars: [{ id: `page-${page}` }],
          };
        },
        isAbortError: (error) => error === abort,
      }),
    ).rejects.toBe(abort);
  });
});

describe("uniqueSitemapCars", () => {
  it("keeps the first car for a repeated id", () => {
    expect(
      uniqueSitemapCars([
        { id: "a", make: "Toyota" },
        { id: "b", make: "Honda" },
        { id: "a", make: "Toyota duplicate" },
      ]),
    ).toEqual([
      { id: "a", make: "Toyota" },
      { id: "b", make: "Honda" },
    ]);
  });
});

describe("buildSitemapXml", () => {
  it("emits escaped locs without fake lastmod or unused image namespaces", () => {
    expect(
      buildSitemapXml([
        sitemapLoc("https://tripdly.com", "/"),
        sitemapLoc("https://tripdly.com", "/search"),
        "https://tripdly.com/cars/2024-toyota-camry-cmmz4f7x00000l804jj2d6ikn",
      ]),
    ).toBe(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://tripdly.com/</loc>
  </url>
  <url>
    <loc>https://tripdly.com/search</loc>
  </url>
  <url>
    <loc>https://tripdly.com/cars/2024-toyota-camry-cmmz4f7x00000l804jj2d6ikn</loc>
  </url>
</urlset>
`);
  });

  it("escapes XML special characters in locs", () => {
    expect(buildSitemapXml(["https://tripdly.com/search?q=a&b=1"])).toContain(
      "<loc>https://tripdly.com/search?q=a&amp;b=1</loc>",
    );
  });
});
