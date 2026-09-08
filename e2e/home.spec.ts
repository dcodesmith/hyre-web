import { expect, type Page, test } from "@playwright/test";

import { HTTP_STATUS } from "../app/api/http-status";
import { clickUntilAttribute, clickUntilVisible } from "./click-until";
import { expectVisualScreenshot } from "./expect-visual-screenshot";

const consentKey = "tripdly-cookie-consent:v1";

async function setCookiePreference(page: Page) {
  await page.addInitScript((key) => {
    localStorage.setItem(key, JSON.stringify({ analytics: false, timestamp: 1 }));
  }, consentKey);
}

test("renders crawlable homepage metadata and booking controls", async ({ page }) => {
  await setCookiePreference(page);
  const response = await page.goto("/");

  expect(response?.status()).toBe(HTTP_STATUS.OK);
  await expect(page).toHaveTitle("Car Rental in Lagos with Driver | Chauffeur Service | Tripdly");
  await expect(
    page.getByRole("heading", { name: "Your Ride, Your Choice", level: 1 }),
  ).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://tripdly.com/",
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    "https://tripdly.com/og-image.jpg",
  );

  const searchForm = page.locator('form[action="/search"]');
  const airportTab = searchForm.getByRole("button", { name: "Airport Pickup" });
  await expect(searchForm).toBeVisible();
  await expect(searchForm.getByRole("button", { name: "Same Day" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await clickUntilAttribute(airportTab, "aria-pressed", "true");
  await expect(page.getByLabel("Flight Number")).toBeVisible();
  const flightNumber = page.getByLabel("Flight Number");
  await expect(async () => {
    await flightNumber.click();
    await flightNumber.fill("");
    await flightNumber.pressSequentially("BA");
    await expect(page.getByRole("button", { name: /British Airways/ })).toBeVisible();
  }).toPass();

  const structuredData = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(structuredData.some((value) => value.includes('"@type":"LocalBusiness"'))).toBe(true);
  expect(structuredData.some((value) => value.includes('"@type":"WebSite"'))).toBe(true);

  await page.goto("/?bookingType=NIGHT");
  const nightSearchForm = page.locator('form[action="/search"]');
  await expect(nightSearchForm.getByRole("button", { name: "Night" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(nightSearchForm.locator('input[name="pickupTime"]')).toHaveValue("11 PM");
});

test("hides the mobile nav after scrolling, then shows it again", async ({ page, viewport }) => {
  await setCookiePreference(page);
  await page.goto("/");

  const nav = page.locator("[data-public-mobile-nav]");

  if ((viewport?.width ?? 0) >= 768) {
    await expect(page.getByRole("navigation", { name: "Primary" })).toBeHidden();
    return;
  }

  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
  await expect(nav).toBeInViewport();

  await page.evaluate(() => window.scrollTo(0, 200));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
  await expect(nav).toHaveJSProperty("inert", true);
  await expect(nav).not.toBeInViewport();

  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expect(nav).toHaveJSProperty("inert", false);
  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
  await expect(nav).toBeInViewport();
});

test("opens the AI search dialog from the homepage", async ({ page }) => {
  await setCookiePreference(page);
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Search by AI" });
  await clickUntilVisible(trigger, page.getByRole("dialog", { name: "Search by AI" }));
  await expect(page.getByLabel("Describe your search")).toBeVisible();
});

test("matches the responsive homepage baseline", async ({ page }) => {
  await setCookiePreference(page);
  await page.goto("/__visual/home");
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      Array.from(document.images, (image) => (image.complete ? undefined : image.decode())),
    );
  });

  await expectVisualScreenshot(page, "home.png", {
    fullPage: true,
    mask: [page.locator("[data-visual-dynamic]")],
    maskColor: "#f3f4f6",
  });
});
