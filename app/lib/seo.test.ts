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
    const description = metadata.find(
      (descriptor) => "name" in descriptor && descriptor.name === "description",
    );

    expect(description).toBeDefined();
    expect("content" in (description ?? {}) ? description?.content.length : 0).toBeLessThanOrEqual(
      155,
    );
  });
});

describe("staticPageHeaders", () => {
  it("allows short browser caching and longer edge caching", () => {
    expect(staticPageHeaders()["Cache-Control"]).toBe(
      "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800",
    );
  });
});
