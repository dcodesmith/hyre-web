import { describe, expect, it } from "vitest";

import { buildRobotsTxt } from "./robots";

describe("buildRobotsTxt", () => {
  it("blocks the whole host when the deployment is not production", () => {
    expect(buildRobotsTxt({ origin: "https://tripdly.com", allowIndexing: false })).toBe(
      "User-agent: *\nDisallow: /\n",
    );
  });

  it("allows the public site and points crawlers at the production sitemap", () => {
    const robots = buildRobotsTxt({
      origin: "https://tripdly.com",
      allowIndexing: true,
      privatePaths: ["/admin", "/api", "/bookings", "/referrals"],
    });

    expect(robots).toContain("Allow: /");
    expect(robots).toContain("Disallow: /admin");
    expect(robots).toContain("Disallow: /api/");
    expect(robots).toContain("Disallow: /bookings");
    expect(robots).toContain("Sitemap: https://tripdly.com/sitemap.xml");
    expect(robots).toContain("Disallow: /referrals");
    expect(robots).not.toContain("/partners/");
  });
});
