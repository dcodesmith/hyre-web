import { describe, expect, it } from "vitest";

import { buildPageMetadata, staticPageHeaders } from "./metadata";

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

  it("marks private pages noindex", () => {
    const metadata = buildPageMetadata({
      title: "Log in | Tripdly",
      description: "Sign in with a one-time email code.",
      path: "/auth",
      index: false,
    });

    expect(metadata).toContainEqual({ name: "robots", content: "noindex, nofollow" });
    expect(metadata).not.toContainEqual({ name: "robots", content: "index, follow" });
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

  it("resolves a relative social image against the production origin", () => {
    const metadata = buildPageMetadata({
      title: "Tripdly",
      description: "Book a chauffeur-driven vehicle.",
      path: "/",
      image: "/og-image.jpg",
    });

    expect(metadata).toContainEqual({
      property: "og:image",
      content: "https://tripdly.com/og-image.jpg",
    });
    expect(metadata).toContainEqual({
      name: "twitter:image",
      content: "https://tripdly.com/og-image.jpg",
    });
  });
});

describe("staticPageHeaders", () => {
  it("allows short browser caching and longer edge caching", () => {
    expect(staticPageHeaders()["Cache-Control"]).toBe(
      "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800",
    );
  });
});
