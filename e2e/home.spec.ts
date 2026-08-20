import { expect, type Page, test } from "@playwright/test";

const consentKey = "tripdly-cookie-consent:v1";

async function setCookiePreference(page: Page) {
  await page.addInitScript((key) => {
    localStorage.setItem(key, JSON.stringify({ analytics: false, timestamp: 1 }));
  }, consentKey);
}

test("renders crawlable homepage metadata and booking controls", async ({ page }) => {
  await setCookiePreference(page);
  const response = await page.goto("/");

  expect(response?.status()).toBe(200);
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
  await expect(searchForm).toBeVisible();
  await expect(searchForm.getByRole("button", { name: "Same Day" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await searchForm.getByRole("button", { name: "Airport" }).click();
  await expect(searchForm.getByRole("button", { name: "Airport" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByLabel("Flight Number")).toBeVisible();
  await page.getByLabel("Flight Number").fill("BA");
  await expect(page.getByRole("button", { name: /British Airways/ })).toBeVisible();

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

test("matches the responsive homepage baseline", async ({ page }) => {
  await setCookiePreference(page);
  await page.goto("/__visual/home");
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      Array.from(document.images, (image) => (image.complete ? undefined : image.decode())),
    );
  });

  await expect(page).toHaveScreenshot("home.png", {
    fullPage: true,
    mask: [page.locator("[data-visual-dynamic]")],
    maskColor: "#f3f4f6",
  });
});
