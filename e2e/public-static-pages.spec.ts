import { expect, type Page, test } from "@playwright/test";

const consentKey = "tripdly-cookie-consent:v1";

const staticPages = [
  {
    path: "/about",
    heading: "About Tripdly",
    title: "About Us - Connecting Fleet Owners with Customers | Tripdly",
  },
  {
    path: "/faq",
    heading: "Frequently Asked Questions",
    title: "FAQ - Frequently Asked Questions | Tripdly Chauffeur Service",
  },
  {
    path: "/terms",
    heading: "Terms of Service",
    title: "Terms of Service | Tripdly",
  },
  {
    path: "/privacy",
    heading: "Privacy Policy",
    title: "Privacy Policy | Tripdly",
  },
  {
    path: "/cookies",
    heading: "Cookie Policy",
    title: "Cookie Policy | Tripdly",
  },
] as const;

async function setCookiePreference(page: Page, analytics = false) {
  await page.addInitScript(
    ({ key, value }) => {
      localStorage.setItem(key, value);
    },
    {
      key: consentKey,
      value: JSON.stringify({ analytics, timestamp: 1 }),
    },
  );
}

for (const staticPage of staticPages) {
  test(`${staticPage.path} renders crawlable metadata and content`, async ({ page }) => {
    await setCookiePreference(page);
    const response = await page.goto(staticPage.path);

    expect(response?.status()).toBe(200);
    expect(response?.headers()["cache-control"]).toContain("public");
    await expect(page).toHaveTitle(staticPage.title);
    await expect(page.getByRole("heading", { name: staticPage.heading, level: 1 })).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      `https://tripdly.com${staticPage.path}`,
    );
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /Tripdly/i);
  });
}

test("filters FAQ questions and exposes an empty state", async ({ page }) => {
  await setCookiePreference(page);
  await page.goto("/faq");

  const bookingTab = page.getByRole("tab", { name: /Booking & Reservations/ });
  const airportTab = page.getByRole("tab", { name: /Airport Transfers/ });
  await expect(bookingTab).toHaveAttribute("aria-selected", "true");
  await expect(async () => {
    await airportTab.scrollIntoViewIfNeeded();
    await airportTab.click();
    await expect(airportTab).toHaveAttribute("aria-selected", "true");
  }).toPass();

  const search = page.getByRole("searchbox", { name: "Search frequently asked questions" });
  await search.fill("flight tracking");
  await expect(search).toHaveValue("flight tracking");
  await expect(page.getByRole("heading", { name: "Airport Transfers" })).toBeVisible();
  await expect(page.getByRole("button", { name: "How does flight tracking work?" })).toBeVisible();

  await search.fill("no matching tripdly question");
  await expect(page.getByText("No questions found matching your search.")).toBeVisible();
});

test("updates analytics consent from the cookie policy", async ({ page }) => {
  await setCookiePreference(page, false);
  await page.goto("/cookies");

  await expect(page.getByText(/does not currently set analytics cookies/i)).toBeVisible();
  await expect(page.getByText("You have declined analytics cookies.")).toBeVisible();
  await page.getByRole("button", { name: "Accept", exact: true }).click();
  await expect(page.getByText("You have accepted analytics cookies.")).toBeVisible();
});

test("matches the responsive About page baseline", async ({ page }) => {
  await setCookiePreference(page);
  await page.goto("/about");
  await page.evaluate(() => document.fonts.ready);

  await expect(page).toHaveScreenshot("about.png", {
    fullPage: true,
    mask: [page.locator("[data-visual-dynamic]")],
    maskColor: "#f3f4f6",
  });
});
