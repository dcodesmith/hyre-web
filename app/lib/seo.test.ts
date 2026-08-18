import { describe, expect, it } from "vitest";

import { buildPageMetadata, staticPageHeaders } from "./seo";

describe("buildPageMetadata", () => {
  it("builds canonical and social metadata from the production origin", () => {
    const metadata = buildPageMetadata({
      title: "About Tripdly",
      description: "Learn more about Tripdly.",
      path: "/about",
    });

    expect(metadata).toContainEqual({ title: "About Tripdly" });
    expect(metadata).toContainEqual({
      tagName: "link",
      rel: "canonical",
      href: "https://tripdly.com/about",
    });
    expect(metadata).toContainEqual({
      property: "og:url",
      content: "https://tripdly.com/about",
    });
  });

  it("keeps descriptions within the search-snippet limit", () => {
    const metadata = buildPageMetadata({
      title: "Long description",
      description: "Tripdly ".repeat(30),
      path: "/faq",
    });
    expect(metadata).toContainEqual({
      name: "description",
      content: expect.stringMatching(/^.{1,155}$/),
    });
  });

  it("adds large social-image metadata when a page provides an image", () => {
    const image = "https://tripdly.com/og-image.jpg";
    const metadata = buildPageMetadata({
      title: "Tripdly",
      description: "Book a chauffeur-driven vehicle.",
      path: "/",
      image,
    });

    expect(metadata).toContainEqual({ property: "og:image", content: image });
    expect(metadata).toContainEqual({ name: "twitter:image", content: image });
    expect(metadata).toContainEqual({ name: "twitter:card", content: "summary_large_image" });
  });
});

describe("staticPageHeaders", () => {
  it("allows short browser caching and longer edge caching", () => {
    expect(staticPageHeaders()["Cache-Control"]).toBe(
      "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800",
    );
  });
});
